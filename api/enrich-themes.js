/**
 * One-time batch job that reads every exhibition from Azure Table Storage,
 * asks OpenAI (gpt-5-nano) which preference themes apply, and writes the
 * themes back to the exhibitions table as themesJson.
 *
 * Usage:
 *   cd api
 *   SET OPENAI_API_KEY=...          (Windows)
 *   SET AZURE_STORAGE_CONNECTION_STRING=...
 *   node enrich-themes.js [--dry-run] [--force] [--batch-size N]
 *
 * Flags:
 *   --dry-run      Print the AI output without writing to Table Storage.
 *   --force        Re-process exhibitions that already have themesJson.
 *   --batch-size   Number of exhibitions per LLM call (default: 15).
 */

const { TableClient } = require('@azure/data-tables');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

const PREFERENCES_PATH = path.join(__dirname, 'preferences.json');
const EXHIBITIONS_TABLE_NAME = 'exhibitions';
const MODEL = 'gpt-5-nano';
const DEFAULT_BATCH_SIZE = 15;
const MAX_DESCRIPTION_LENGTH = 1200;
const MAX_RETRIES = 3;

function loadEnv() {
    // Allow local.settings.json to be the source of truth during local dev.
    const localSettingsPath = path.join(__dirname, 'local.settings.json');
    if (fs.existsSync(localSettingsPath)) {
        try {
            const settings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
            for (const [key, value] of Object.entries(settings.Values || {})) {
                if (!process.env[key]) process.env[key] = value;
            }
        } catch (err) {
            console.warn('Could not read local.settings.json:', err.message);
        }
    }

    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
        throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set.');
    }
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not set.');
    }
}

function buildAllowedThemes() {
    const preferences = JSON.parse(fs.readFileSync(PREFERENCES_PATH, 'utf8'));
    const allowed = new Set();
    for (const [category, subs] of Object.entries(preferences)) {
        allowed.add(category);
        for (const sub of subs) {
            allowed.add(`${category}-${sub}`);
        }
    }
    return Array.from(allowed).sort();
}

function sanitizeTheme(raw, allowedSet) {
    const cleaned = String(raw).trim();
    if (allowedSet.has(cleaned)) return cleaned;
    // Accept "Category: Subtheme" as well and normalise to "Category-Subtheme".
    const normalised = cleaned.replace(/^([^:]+):\s*/, '$1-');
    if (allowedSet.has(normalised)) return normalised;
    return null;
}

function truncate(text, maxLength) {
    if (!text) return '';
    const stripped = String(text).replace(/\s+/g, ' ').trim();
    if (stripped.length <= maxLength) return stripped;
    return stripped.slice(0, maxLength).replace(/\s+\S*$/, '') + '…';
}

function buildPrompt(exhibitions, allowedThemes) {
    const lines = [
        'You are a museum and exhibition theme classifier.',
        '',
        'Given the list of allowed themes below, identify which themes apply to each exhibition.',
        'Allowed themes are either a top-level category (e.g. "Art") or a category-subtheme pair (e.g. "Art-Old Masters").',
        '',
        `Allowed themes: ${JSON.stringify(allowedThemes)}`,
        '',
        'Return ONLY a JSON object mapping each exhibition ID to an array of matching themes.',
        'Do not include explanations. Do not invent themes outside the allowed list.',
        'If no themes apply, return an empty array for that ID.',
        '',
        'Example output format:',
        '{"exhibit-123": ["Art", "Art-Old Masters"], "exhibit-124": []}',
        '',
        'Exhibitions:'
    ];

    exhibitions.forEach((ex, index) => {
        lines.push(`${index + 1}. ID: ${ex.id}`);
        lines.push(`   Title: ${ex.title}`);
        lines.push(`   Venue: ${ex.venue}`);
        lines.push(`   Category: ${ex.category}`);
        lines.push(`   Short description: ${truncate(ex.shortDescription, 300)}`);
        lines.push(`   Description: ${truncate(ex.description, MAX_DESCRIPTION_LENGTH)}`);
        lines.push('');
    });

    return lines.join('\n');
}

async function classifyBatch(openai, exhibitions, allowedThemes, allowedSet) {
    const prompt = buildPrompt(exhibitions, allowedThemes);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await openai.chat.completions.create({
                model: MODEL,
                messages: [
                    { role: 'system', content: 'You output strict JSON only.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' }
            });

            const raw = response.choices[0]?.message?.content?.trim() || '{}';
            const parsed = JSON.parse(raw);

            const result = {};
            for (const ex of exhibitions) {
                const themes = parsed[ex.id];
                if (Array.isArray(themes)) {
                    result[ex.id] = themes
                        .map(t => sanitizeTheme(t, allowedSet))
                        .filter(Boolean);
                } else {
                    result[ex.id] = [];
                }
            }
            return result;
        } catch (err) {
            console.error(`  Batch classification attempt ${attempt} failed:`, err.message);
            if (attempt === MAX_RETRIES) throw err;
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
}

function chunk(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

function parseArgs() {
    const args = process.argv.slice(2);
    return {
        dryRun: args.includes('--dry-run'),
        force: args.includes('--force'),
        batchSize: Math.max(1, parseInt(args.find((_, i) => args[i - 1] === '--batch-size' && args[i]) || DEFAULT_BATCH_SIZE, 10))
    };
}

async function main() {
    const { dryRun, force, batchSize } = parseArgs();

    loadEnv();
    const allowedThemes = buildAllowedThemes();
    const allowedSet = new Set(allowedThemes);

    console.log(`Allowed themes: ${allowedThemes.length}`);
    console.log(`Batch size: ${batchSize}`);
    console.log(`Dry run: ${dryRun}`);
    console.log(`Force re-process: ${force}`);
    console.log('');

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const tableClient = TableClient.fromConnectionString(
        process.env.AZURE_STORAGE_CONNECTION_STRING,
        EXHIBITIONS_TABLE_NAME
    );

    console.log('Reading exhibitions from Table Storage...');
    const allEntities = [];
    for await (const entity of tableClient.listEntities()) {
        allEntities.push(entity);
    }

    const exhibitions = allEntities.map(entity => ({
        id: entity.rowKey,
        title: entity.title ?? '',
        venue: entity.venue ?? '',
        category: entity.category ?? '',
        shortDescription: entity.shortDescription ?? '',
        description: entity.description ?? '',
        entity
    }));

    const toProcess = force
        ? exhibitions
        : exhibitions.filter(ex => !ex.entity.themesJson);

    console.log(`Total exhibitions: ${exhibitions.length}`);
    console.log(`To process: ${toProcess.length} (${exhibitions.length - toProcess.length} already enriched)`);
    console.log('');

    if (toProcess.length === 0) {
        console.log('Nothing to do.');
        return;
    }

    const batches = chunk(toProcess, batchSize);
    let processedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Batch ${i + 1}/${batches.length} (${batch.length} exhibitions)...`);

        let themesById;
        try {
            themesById = await classifyBatch(openai, batch, allowedThemes, allowedSet);
        } catch (err) {
            console.error(`  Failed to classify batch ${i + 1}:`, err.message);
            skippedCount += batch.length;
            continue;
        }

        if (dryRun) {
            for (const ex of batch) {
                console.log(`  ${ex.id}: ${JSON.stringify(themesById[ex.id])}`);
            }
            processedCount += batch.length;
            continue;
        }

        for (const ex of batch) {
            const themes = themesById[ex.id] ?? [];
            const updatedEntity = {
                partitionKey: ex.entity.partitionKey,
                rowKey: ex.entity.rowKey,
                themesJson: JSON.stringify(themes)
            };

            try {
                await tableClient.updateEntity(updatedEntity, 'Merge');
                processedCount++;
            } catch (err) {
                console.error(`  Failed to update ${ex.id}:`, err.message);
                skippedCount++;
            }
        }
    }

    console.log('');
    console.log('Done.');
    console.log(`Processed: ${processedCount}`);
    console.log(`Skipped/failed: ${skippedCount}`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

const { BlobServiceClient } = require("@azure/storage-blob");
const { TableClient } = require("@azure/data-tables");
const { app } = require("@azure/functions");
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const client = new OAuth2Client();

const EXHIBITIONS_TABLE_NAME = 'exhibitions';
const exhibitionsTableClient = TableClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING,
    EXHIBITIONS_TABLE_NAME
);

const REVIEWS_TABLE_NAME = 'reviews';
const reviewsTableClient = TableClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING,
    REVIEWS_TABLE_NAME
);

async function ensureReviewsTable() {
    try {
        await reviewsTableClient.createTable();
    } catch (error) {
        if (error.statusCode !== 409) throw error;
    }
}

function exhibitionToEntity(exhibition) {
    const id = exhibition.id == null ? '' : String(exhibition.id);
    if (!id) {
        throw new Error(`Exhibition is missing an id: ${JSON.stringify(exhibition.title)}`);
    }

    return {
        partitionKey: 'exhibition',
        rowKey: id,
        title: exhibition.title ?? '',
        venue: exhibition.venue ?? '',
        paid: exhibition.paid == null ? '' : String(exhibition.paid),
        datesJson: JSON.stringify(exhibition.dates ?? []),
        descriptionHTML: exhibition.descriptionHTML ?? '',
        description: exhibition.description ?? '',
        url: exhibition.url ?? '',
        imageUrl: exhibition.imageUrl ?? '',
        shortDescription: exhibition.shortDescription ?? '',
        priceInfo: exhibition.priceInfo ?? '',
        category: exhibition.category ?? '',
        icon: exhibition.icon ?? '',
        dateRangeType: exhibition.dateRangeType ?? ''
    };
}

function entityToExhibition(entity) {
    return {
        id: entity.rowKey,
        title: entity.title,
        venue: entity.venue,
        paid: entity.paid,
        dates: JSON.parse(entity.datesJson ?? '[]'),
        descriptionHTML: entity.descriptionHTML,
        description: entity.description,
        url: entity.url,
        imageUrl: entity.imageUrl,
        shortDescription: entity.shortDescription,
        priceInfo: entity.priceInfo,
        category: entity.category,
        icon: entity.icon,
        dateRangeType: entity.dateRangeType
    };
}

function getGoogleIdToken(request) {
    // Use a custom header because Azure Static Web Apps uses Authorization
    // for its own EasyAuth session token, which would collide with the Google ID token.
    // The Google token is only used to create a session; subsequent requests use the
    // session token in the Authorization header.
    return request.headers.get('X-Google-ID-Token');
}

function getSessionId(request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice('Bearer '.length);
    }
    return null;
}

async function verifyGoogleUser(token) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: '797883913821-9qtpse6mbboe6rh4b62rjhlj47mjddqb.apps.googleusercontent.com'
    });

    const payload = ticket.getPayload();
    // This ID is unique to each Google Account, making it suitable for use as a primary key
    // during account lookup. Email is not a good choice because it can be changed by the user.
    const userid = payload['sub'];
    return { userid, payload };
}

// Cache for exhibitions data
let exhibitionsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const _blob_service = (acct) => {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

    if (connectionString) {
        // Use connection string if available
        return BlobServiceClient.fromConnectionString(connectionString);
    } else {
        console.warn('AZURE_STORAGE_CONNECTION_STRING not set, using anonymous access for public blobs');
        // Use anonymous access for public blobs
        return new BlobServiceClient(
            `https://${acct}.blob.core.windows.net`
        );
    }
};

async function _blob_read_json(container, blob_name) {
    const buffer = await _blob_service('nofomodata')
        .getContainerClient(container)
        .getBlobClient(blob_name)
        .downloadToBuffer()

    return JSON.parse(buffer.toString());
}

async function _blob_write_json(container, blob_name, data) {
    const content = JSON.stringify(data);
    const blockBlobClient = _blob_service('nofomodata')
        .getContainerClient(container)
        .getBlockBlobClient(blob_name);

    await blockBlobClient.upload(content, Buffer.byteLength(content), {
        blobHTTPHeaders: { blobContentType: 'application/json' }
    });
}

async function fetchExhibitionsData(context) {
    // Check cache first
    const now = Date.now();
    if (exhibitionsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION_MS) {
        context.log('Using cached exhibitions data');
        return exhibitionsCache;
    }

    try {
        context.log('Fetching exhibitions from table storage');
        const exhibitions = [];
        for await (const entity of exhibitionsTableClient.listEntities()) {
            exhibitions.push(entityToExhibition(entity));
        }

        // Update cache
        exhibitionsCache = exhibitions;
        cacheTimestamp = now;

        return exhibitions;
    } catch (error) {
        context.error('Error fetching from table storage:', error);

        // If we have stale cache, use it as fallback
        if (exhibitionsCache) {
            context.log('Using stale cache as fallback');
            return exhibitionsCache;
        }

        throw error;
    }
}

function chunk(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

async function migrateExhibitionsFromBlob(context) {
    context.log('Migrating exhibitions from blob to table storage');
    await exhibitionsTableClient.createTable();

    const exhibitions = await _blob_read_json('exhibits-data', 'all_exhibitions.json');
    if (!Array.isArray(exhibitions)) {
        throw new Error('Expected all_exhibitions.json to contain an array');
    }

    const seenKeys = new Set();
    const uniqueExhibitions = [];
    let skippedDuplicateCount = 0;

    for (const ex of exhibitions) {
        const key = ex.id == null ? '' : String(ex.id);
        if (!key) {
            context.log.warn('Skipping exhibition with missing id:', ex.title);
            continue;
        }
        if (seenKeys.has(key)) {
            context.log.warn('Skipping duplicate exhibition id:', key, ex.title);
            skippedDuplicateCount++;
            continue;
        }
        seenKeys.add(key);
        uniqueExhibitions.push(ex);
    }

    let migratedCount = 0;
    let updatedCount = 0;

    for (const ex of uniqueExhibitions) {
        const entity = exhibitionToEntity(ex);
        try {
            await exhibitionsTableClient.createEntity(entity);
            migratedCount++;
        } catch (error) {
            if (error.statusCode === 409) {
                // Entity already exists; replace it with the latest blob data
                await exhibitionsTableClient.upsertEntity(entity, 'Replace');
                updatedCount++;
            } else {
                context.error('Row failed:', ex.id, ex.title, error.message);
                throw error;
            }
        }
    }

    context.log(`Migrated ${migratedCount} new exhibitions, updated ${updatedCount} existing, skipped ${skippedDuplicateCount} duplicates`);
    return { migratedCount, updatedCount, skippedDuplicateCount };
}

async function fetchUserFromBlob(context, userId) {
    try {
        context.log('Fetching user from blob storage');
        const data = await _blob_read_json("users", userId + `.json`);

        return data;
    } catch (error) {
        context.error('Error fetching from blob storage:', error);

        // // If we have stale cache, use it as fallback
        // if (exhibitionsCache) {
        //     context.log('Using stale cache as fallback');
        //     return exhibitionsCache;
        // }

        throw error;
    }
}

const SUPPORTED_USER_UPDATE_ACTIONS = ['updateFavourites', 'updateVisited', 'updatePreferences'];
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateSessionId() {
    return crypto.randomBytes(32).toString('base64url');
}

async function createSession(context, userId, profile, userData) {
    const sessionId = generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS).toISOString();
    const userIsAdmin = userData?.userRole === 'admin';

    await _blob_write_json('sessions', `${sessionId}.json`, {
        userId,
        profile,
        userIsAdmin,
        createdAt: now.toISOString(),
        expiresAt
    });

    context.log('Created session for user:', userId );

    return { sessionId, expiresAt };
}

async function loadSession(context, sessionId) {
    try {
        const session = await _blob_read_json('sessions', `${sessionId}.json`);
        const now = new Date();
        if (new Date(session.expiresAt) < now) {
            context.log('Session expired:', sessionId.slice(0, 8));
            return null;
        }

        // Extend session expiry on each use (sliding 30-day window)
        session.expiresAt = new Date(now.getTime() + SESSION_DURATION_MS).toISOString();
        await _blob_write_json('sessions', `${sessionId}.json`, session);

        return session;
    } catch {
        return null;
    }
}

async function deleteSession(context, sessionId) {
    try {
        const blobClient = _blob_service('nofomodata')
            .getContainerClient('sessions')
            .getBlobClient(`${sessionId}.json`);
        await blobClient.deleteIfExists();
    } catch (error) {
        context.error('Error deleting session:', error);
    }
}

async function requireSession(request, context) {
    const sessionId = getSessionId(request);
    if (!sessionId) {
        return { status: 401, jsonBody: { error: 'Missing session' } };
    }

    const session = await loadSession(context, sessionId);
    if (!session) {
        return { status: 401, jsonBody: { error: 'Invalid or expired session' } };
    }

    return { userId: session.userId, profile: session.profile, userIsAdmin: session.userIsAdmin };
}

async function requireAdminSession(request, context) {
    const sessionResult = await requireSession(request, context);
    if (sessionResult.status) return sessionResult;

    if (!sessionResult.userIsAdmin) {
        return { status: 403, jsonBody: { error: 'Admin access required' } };
    }

    return sessionResult;
}

async function updateUserInBlob(context, userId, action, { favourites, visited, preferences }) {
    // Load any existing record for this user, defaulting to an empty one if
    // this is the user's first update (i.e. their file doesn't exist yet)
    let userData;
    try {
        userData = await fetchUserFromBlob(context, userId);
    } catch (error) {
        context.log('No existing record for user ' + userId + ', creating a new one');
        userData = {};
    }

    if (action === 'updateFavourites') {
        userData.favourites = favourites;
    } else if (action === 'updateVisited') {
        userData.visited = visited;
    } else if (action === 'updatePreferences') {
        userData.preferences = preferences;
    }

    await _blob_write_json('users', userId + '.json', userData);
    return userData;
}

app.http('createSession', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'auth/session',
    handler: async (request, context) => {
        const idToken = getGoogleIdToken(request);
        if (!idToken) {
            return { status: 401, jsonBody: { error: 'Missing or invalid X-Google-ID-Token header' } };
        }

        // Diagnostic: log the received JWT header (safe, no signature/payload)
        try {
            const [headerB64] = idToken.split('.');
            const header = JSON.parse(Buffer.from(headerB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
            context.log('Received JWT header:', header);
        } catch (e) {
            context.log('Received token is not a standard JWT:', idToken?.slice(0, 30));
        }

        // Verify the Google ID token server-side before trusting any of its contents
        let userid, payload;
        try {
            ({ userid, payload } = await verifyGoogleUser(idToken));
            context.log('Token verified for user:', userid);
        } catch (error) {
            context.error('Error verifying Google token:', error.message || error);
            return { status: 401, jsonBody: { error: 'Invalid Google token', details: error.message || String(error) } };
        }

        // Look up any previously stored data for this user, but don't fail
        // the request if none exists yet
        let userData = null;
        try {
            userData = await fetchUserFromBlob(context, userid);
        } catch (error) {
            context.log('No stored data found for user ' + userid);
        }

        const { sessionId, expiresAt } = await createSession(context, userid, payload, userData);

        

        return {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            jsonBody: { sessionId, expiresAt, userid, profile: payload, userData }
        };
    }
})

app.http('deleteSession', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'auth/session',
    handler: async (request, context) => {
        const sessionId = getSessionId(request);
        if (sessionId) {
            await deleteSession(context, sessionId);
        }
        return { status: 204 };
    }
})

app.http('user', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'user',
    handler: async (request, context) => {
        const session = await requireSession(request, context);
        if (session.status) return session;

        const { userId, profile } = session;
        context.log('Fetching user ' + userId);

        // Look up any previously stored data for this user, but don't fail
        // the request if none exists yet
        let userData = null;
        try {
            userData = await fetchUserFromBlob(context, userId);
        } catch (error) {
            context.log('No stored data found for user ' + userId);
        }

        return {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            jsonBody: { userid: userId, profile, userData }
        };
    }
})

app.http('updateUser', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'user',
    handler: async (request, context) => {
        const session = await requireSession(request, context);
        if (session.status) return session;

        const { userId } = session;

        let body;
        try {
            body = await request.json();
        } catch (error) {
            return { status: 400, jsonBody: { error: 'Invalid or missing JSON body' } };
        }

        const { action, favourites, visited, preferences } = body || {};

        if (!SUPPORTED_USER_UPDATE_ACTIONS.includes(action)) {
            return { status: 400, jsonBody: { error: `action must be one of: ${SUPPORTED_USER_UPDATE_ACTIONS.join(', ')}` } };
        }

        if (action === 'updateFavourites' && !Array.isArray(favourites)) {
            return { status: 400, jsonBody: { error: 'favourites must be an array' } };
        }

        if (action === 'updateVisited' && !Array.isArray(visited)) {
            return { status: 400, jsonBody: { error: 'visited must be an array' } };
        }

        try {
            const userData = await updateUserInBlob(context, userId, action, { favourites, visited, preferences });
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                jsonBody: { userid: userId, userData }
            };
        } catch (error) {
            context.error('Error updating user data:', error);
            return { status: 500, jsonBody: { error: 'Internal server error' } };
        }
    }
})

app.http('exhibitions', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'exhibitions',
    handler: async (request, context) => {
        context.log('Exhibitions API function processed a request.');

        try {
            // Fetch exhibitions data from table storage
            const exhibitions = await fetchExhibitionsData(context);
            let filteredExhibitions = [...exhibitions];

            // Filter by start date (exhibitions ending on or after this date)
            // const startDate = request.query.get('startDate');
            // if (startDate) {
            //     const startDateObj = new Date(startDate);
            //     filteredExhibitions = filteredExhibitions.filter(ex => {
            //         const endDate = new Date(ex.dates[ex.dates.length - 1]);
            //         return endDate >= startDateObj;
            //     });
            // }

            // // Filter by end date (exhibitions starting on or before this date)
            // const endDate = request.query.get('endDate');
            // if (endDate) {
            //     const endDateObj = new Date(endDate);
            //     filteredExhibitions = filteredExhibitions.filter(ex => {
            //         const startDate = new Date(ex.dates[0]);
            //         return startDate <= endDateObj;
            //     });
            // }

            // Filter by venue
            const venue = request.query.get('venue');
            if (venue) {
                const venues = Array.isArray(venue) ? venue : [venue];
                filteredExhibitions = filteredExhibitions.filter(ex =>
                    venues.includes(ex.venue)
                );
            }

            // Filter by paid/free
            const paid = request.query.get('paid');
            if (paid) {
                filteredExhibitions = filteredExhibitions.filter(ex =>
                    ex.paid === paid
                );
            }

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                jsonBody: filteredExhibitions
            };
        } catch (error) {
            context.error('Error processing request:', error);
            return {
                status: 500,
                jsonBody: { error: 'Internal server error' }
            };
        }
    }
})

app.http('migrateExhibitions', {
    methods: ['POST'],
    authLevel: 'function',
    route: 'exhibitions/migrate',
    handler: async (request, context) => {
        try {
            const { migratedCount, updatedCount, skippedDuplicateCount } = await migrateExhibitionsFromBlob(context);
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                jsonBody: { migratedCount, updatedCount, skippedDuplicateCount, message: 'Migration complete' }
            };
        } catch (error) {
            context.error('Error migrating exhibitions:', error);
            return {
                status: 500,
                jsonBody: { error: 'Migration failed', details: error.message || String(error) }
            };
        }
    }
})

app.http('updateExhibition', {
    methods: ['PATCH'],
    authLevel: 'anonymous',
    route: 'exhibitions/{id}',
    handler: async (request, context) => {
        const session = await requireAdminSession(request, context);
        if (session.status) return session;

        const id = request.params.id;

        let body;
        try {
            body = await request.json();
        } catch {
            return { status: 400, jsonBody: { error: 'Invalid or missing JSON body' } };
        }

        try {
            await exhibitionsTableClient.getEntity('exhibition', id);
        } catch {
            return { status: 404, jsonBody: { error: 'Exhibition not found' } };
        }

        const updates = {
            partitionKey: 'exhibition',
            rowKey: id
        };

        if (body.title !== undefined) updates.title = body.title;
        if (body.venue !== undefined) updates.venue = body.venue;
        if (body.paid !== undefined) updates.paid = String(body.paid);
        if (body.dates !== undefined) updates.datesJson = JSON.stringify(body.dates);
        if (body.description !== undefined) updates.description = body.description;
        if (body.descriptionHTML !== undefined) updates.descriptionHTML = body.descriptionHTML;
        if (body.priceInfo !== undefined) updates.priceInfo = body.priceInfo;
        if (body.shortDescription !== undefined) updates.shortDescription = body.shortDescription;
        if (body.url !== undefined) updates.url = body.url;
        if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl;
        if (body.category !== undefined) updates.category = body.category;
        if (body.icon !== undefined) updates.icon = body.icon;
        if (body.dateRangeType !== undefined) updates.dateRangeType = body.dateRangeType;

        try {
            await exhibitionsTableClient.updateEntity(updates, 'Merge');

            // Invalidate the in-memory aggregate cache so the next read is fresh.
            exhibitionsCache = null;
            cacheTimestamp = null;

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                jsonBody: { id, ...updates }
            };
        } catch (error) {
            context.error('Error updating exhibition:', error);
            return { status: 500, jsonBody: { error: 'Internal server error' } };
        }
    }
})

app.http('deleteExhibition', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'exhibitions/{id}',
    handler: async (request, context) => {
        const session = await requireAdminSession(request, context);
        if (session.status) return session;

        const id = request.params.id;
        try {
            await exhibitionsTableClient.deleteEntity('exhibition', id);

            exhibitionsCache = null;
            cacheTimestamp = null;

            return { status: 204 };
        } catch (error) {
            context.error('Error deleting exhibition:', error);
            return { status: 500, jsonBody: { error: 'Internal server error' } };
        }
    }
})

app.http('uploadExhibitionImage', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'exhibitions/{id}/image',
    handler: async (request, context) => {
        const session = await requireAdminSession(request, context);
        if (session.status) return session;

        const id = request.params.id;

        let body;
        try {
            body = await request.json();
        } catch {
            return { status: 400, jsonBody: { error: 'Invalid or missing JSON body' } };
        }

        const { image } = body || {};
        if (!image || typeof image !== 'string') {
            return { status: 400, jsonBody: { error: 'image (base64) is required' } };
        }

        try {
            const buffer = Buffer.from(image, 'base64');
            const blobService = _blob_service('nofomodata');
            const blockBlobClient = blobService
                .getContainerClient('images')
                .getBlockBlobClient(`${id}.png`);

            await blockBlobClient.upload(buffer, buffer.length, {
                blobHTTPHeaders: { blobContentType: 'image/png' }
            });

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                jsonBody: { imageUrl: `${id}.png` }
            };
        } catch (error) {
            context.error('Error uploading exhibition image:', error);
            return { status: 500, jsonBody: { error: 'Internal server error' } };
        }
    }
})

app.http('createReview', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'reviews',
    handler: async (request, context) => {
        const session = await requireSession(request, context);
        if (session.status) return session;

        let body;
        try {
            body = await request.json();
        } catch {
            return { status: 400, jsonBody: { error: 'Invalid or missing JSON body' } };
        }

        const { exhibitId, time, stars, comment } = body || {};

        if (!exhibitId) {
            return { status: 400, jsonBody: { error: 'exhibitId is required' } };
        }

        if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5) {
            return { status: 400, jsonBody: { error: 'stars must be an integer between 1 and 5' } };
        }

        const validTimes = ['<15m', '15-1h', '1hr+'];
        if (time !== undefined && time !== null && !validTimes.includes(time)) {
            return { status: 400, jsonBody: { error: `time must be one of: ${validTimes.join(', ')}` } };
        }

        if (comment !== undefined && comment !== null && comment.length > 1000) {
            return { status: 400, jsonBody: { error: 'comment must be 1000 characters or fewer' } };
        }

        const reviewId = crypto.randomUUID();

        try {
            await ensureReviewsTable();
            await reviewsTableClient.createEntity({
                partitionKey: String(exhibitId),
                rowKey: reviewId,
                exhibitId: String(exhibitId),
                userId: session.userId,
                time: time || '',
                stars,
                comment: comment || ''
            });

            return {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
                jsonBody: { reviewId, exhibitId, userId: session.userId, time, stars, comment }
            };
        } catch (error) {
            context.error('Error creating review:', error);
            return { status: 500, jsonBody: { error: 'Internal server error' } };
        }
    }
})

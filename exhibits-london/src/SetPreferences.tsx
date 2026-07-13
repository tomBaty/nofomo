import { useState, useMemo } from "react";
import './SetPreferences.css';

const CATEGORY_COLORS = {
    'Art': '#b42430',
    'Sculpture': '#ad6b35',
    'Photography': '#1a7066',
    'History': '#9c823f',
    'Science': '#2e5361',
    'Music': '#6f3bad',
    'Theatre': '#db50a3',
    'Dance': '#0d87af',
    'Film': '#da8216',
    'Literature': '#577590',
    'Military': '#6a4c93',
    'Architecture': '#43aa8b',
    'Other': '#678b4b',
    'Royals': '#d4af37'
};

const PREFERENCES = {
    'Art': [
        'Old Masters',
        '1800s',
        '1900s',
        'Modern'
    ],
    'Sculpture': [
        'Classical',
        'Modern'
    ],
    'Photography': [
        'Portraits',
        'Street',
        'Documentary'
    ],
    'History': [
        'America',
        'Africa',
        'Europe',
        'Ancient',
        'Medieval',
        'Renaissance',
        'Imperialism',
        'London'
    ],
    'Science': [
        'Astronomy',
        'Biology',
        'Medicine',
        'Technology',
        'Natural History',
        'Physics'
    ],
    // 'Music': [
    //     'Classical',
    //     'Jazz',
    //     'Rock & Pop',
    //     'Opera',
    //     'Folk',
    //     'Electronic'
    // ],
    'Theatre': [
        'Shakespeare',
        'Modern',
        'Musicals',
        'Comedy'
    ],
    // 'Dance': [
    //     'Ballet',
    //     'Contemporary Dance',
    //     'Folk Dance'
    // ],
    'Film': [
        'Blockbuster',
        'Arthouse',
        'IMAX',
        'Documentary',
        'Animation'
    ],
    'Literature': [
        'Poetry',
        'Fiction',
        'Classics'
    ],
    'Military': [
        'WWI',
        'WWII',
        'Medieval',
        'Naval',
        'Aviation'
    ],
    'Architecture': [
        'Ancient',
        '1800s',
        '1900s',
        'Modern',
        'Islamic'
    ],
    'Other': [
        'Fashion',
        'Design',
        'Crafts',
        'Food & Drink'
    ],
    'Royals': []
};

interface setPreferenceProps {
    onSkip: () => void
    onSave: (prefs: string[]) => void
    preferences: string[]
}

interface Pill {
    category: string
    value: string
    isTopLevel: boolean
    pinned?: boolean
}

export function SetPreferences({ onSkip, onSave, preferences }: setPreferenceProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set(preferences));
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const togglePreference = (category: string, value: string, isTopLevel: boolean) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(value)) {
                next.delete(value);
            } else {
                next.add(value);
            }
            return next;
        });

        if (isTopLevel) {
            setExpanded(prev => {
                const next = new Set(prev);
                if (next.has(category)) {
                    next.delete(category);
                } else {
                    next.add(category);
                }
                return next;
            });
        }
    };

    const allPills = useMemo(() => {
        const pills: Pill[] = [];
        Object.entries(PREFERENCES).forEach(([category, subPreferences]) => {
            const isExpanded = expanded.has(category);
            const hasSelectedSub = subPreferences.some(sub => selected.has(sub));
            const showSubThemes = isExpanded || hasSelectedSub;

            pills.push({ category, value: category, isTopLevel: true });

            if (showSubThemes) {
                subPreferences.forEach(sub => {
                    pills.push({
                        category,
                        value: sub,
                        isTopLevel: false,
                        pinned: !isExpanded && hasSelectedSub
                    });
                });
            }
        });
        return pills;
    }, [expanded, selected]);

    const handleSave = () => {
        onSave(Array.from(selected));
    };

    return (
        <div className="preferences-overlay">
            <div className="preferences-panel">
                <h2>What are you interested in?</h2>
                <p className="preferences-intro">
                    Pick the topics you love. We'll use these to recommend exhibitions you'll enjoy.
                </p>

                <div className="preferences-grid">
                    {allPills.map(({ category, value, isTopLevel, pinned }) => {
                        const isSelected = selected.has(isTopLevel ? value : `${category}-${value}`);
                        const pillColor: string = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS]
                        return (
                            <button
                                key={isTopLevel ? value : `${category}-${value}`}
                                className={`preference-pill${isTopLevel ? '' : ' sub-preference'}${isSelected ? ' selected' : ''}${pinned ? ' pinned' : ''}`}
                                style={{ backgroundColor: pillColor }}
                                onClick={() => togglePreference(category, isTopLevel ? value : `${category}-${value}`, isTopLevel)}
                            >
                                {value}
                            </button>
                        );
                    })}
                </div>

                <div className="preferences-actions">
                    <span className="preferences-count">
                        {selected.size} selected
                    </span>
                    <button className="preferences-skip" onClick={onSkip}>
                        Skip
                    </button>
                    <button className="preferences-save" onClick={handleSave}>
                        Save preferences
                    </button>
                </div>
            </div>
        </div>
    );
}
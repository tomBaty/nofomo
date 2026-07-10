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
        'Contemporary Art',
        'Impressionism',
        '1900s',
        'Victorian & Pre-Raphaelite'
    ],
    'Sculpture': [
        'Classical',
        'Modern'
    ],
    'Photography': [
        'Portraits',
        'Street Photography',
        'Landscape',
        'Documentary',
        'Fashion Photography',
        'Fine Art Photography'
    ],
    'History': [
        'America',
        'Africa',
        'Europe',
        'Rome',
        'Egypt',
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
        'Palaeontology',
        'Physics'
    ],
    'Music': [
        'Classical',
        'Jazz',
        'Rock & Pop',
        'Opera',
        'Folk',
        'Electronic'
    ],
    'Theatre': [
        'Shakespeare',
        'Contemporary Drama',
        'Musical Theatre',
        'Comedy'
    ],
    'Dance': [
        'Ballet',
        'Contemporary Dance',
        'Folk Dance'
    ],
    'Film': [
        'Cinema History',
        'Documentary',
        'Animation',
        'Experimental'
    ],
    'Literature': [
        'Poetry',
        'Fiction',
        'Drama',
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
        'Modern Architecture',
        'Gothic',
        'Brutalism',
        'Victorian',
        'Islamic Architecture'
    ],
    'Other': [
        'Fashion',
        'Design',
        'Crafts',
        'Food & Drink'
    ],
    'Royals': [
        'Tudors',
        'Stuarts',
        'Victorians',
        'Windsors',
        'Coronations'
    ]
};

export function SetPreferences({ onSkip, onSave }) {
    const [selected, setSelected] = useState(new Set());
    const [expanded, setExpanded] = useState(new Set());

    const togglePreference = (category, value, isTopLevel) => {
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
        const pills = [];
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
        onSave?.(Array.from(selected));
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
                        const isSelected = selected.has(value);
                        return (
                            <button
                                key={value}
                                className={`preference-pill${isTopLevel ? '' : ' sub-preference'}${isSelected ? ' selected' : ''}${pinned ? ' pinned' : ''}`}
                                style={{ backgroundColor: CATEGORY_COLORS[category] }}
                                onClick={() => togglePreference(category, value, isTopLevel)}
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
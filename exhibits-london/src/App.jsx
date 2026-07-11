import { useState, useEffect, useMemo, useCallback, useRef, useReducer } from "react";
import { startOfDay, endOfDay, addDays, isWithinInterval, parseISO } from 'date-fns';
import './App.css'
import { Exhibit } from "./Exhibit";
import { CalendarDatePicker } from "./CalendarDatePicker";
import { NavBar } from "./NavBar";
import { SkeletonLoader } from "./SkeletonLoader";
import { IMAGE_BASE_URL } from "./constants";
import { VenueMap } from "./VenueMap";
import venues from "./venue_information.json"
import { SetPreferences } from "./SetPreferences";

// API endpoint - works with Azure Functions locally and when deployed
const API_URL = '/api/exhibitions?startDate=' + startOfDay(new Date()).toISOString().split('T')[0]

// Fuzzy text matching function - returns a score from 0 to 1
const fuzzyMatchScore = (text, searchTerm) => {
    if (!text || !searchTerm) return 0;
    const searchLower = searchTerm.toLowerCase().trim();
    const textLower = text.toLowerCase();

    if (textLower === searchLower) return 1.0;

    if (textLower.includes(searchLower)) {
        if (textLower.startsWith(searchLower)) return 0.95;
        return 0.9;
    }

    const searchChars = searchLower.split('');
    let textIndex = 0;
    let matchedChars = 0;

    for (let char of searchChars) {
        while (textIndex < textLower.length) {
            if (textLower[textIndex] === char) {
                matchedChars++;
                textIndex++;
                break;
            }
            textIndex++;
        }
    }

    const matchPercentage = matchedChars / searchChars.length;
    return matchPercentage >= 0.7 ? matchPercentage : 0;
};

// const changeFilters = (state, action) => {
//     if(action.type == 'toggle_filter') {
//         if(state[action.filterType].includes(action.filter)){
//             state[action.filterType].splice(action.filter)
//         } else {
//             state[action.filterType].append(action.filter)
//         }
//     }
// }

function App() {
    const [exhibitions, setExhibitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [mapExpanded, setMapExpanded] = useState(false);
    const [expandedExhibit, setExpandedExhibit] = useState(null);
    const [filteringByFavourites, setFilteringByFavourites] = useState(false);
    const [favourites, setFavourites] = useState(() => JSON.parse(localStorage.getItem('favourites') || '[]'));
    const [visited, setVisited] = useState(() => JSON.parse(localStorage.getItem('visited') || '[]'));
    const [showPreferences, setShowPreferences] = useState(true)
    const [userProfile, setUserProfile] = useState(() => {
        const stored = localStorage.getItem("googleUserProfile");
        if (!stored) return null;

        const parsed = JSON.parse(stored);

        if (!parsed.idToken) {
            localStorage.removeItem("googleUserProfile");
            return null;
        }

        return parsed;
    });
    const filtersInitialized = useRef(false);
    const mapInitialized = useRef(false);
    const favouritesSyncTimeout = useRef(null);
    const visitedSyncTimeout = useRef(null);
    const prefSyncTimeout = useRef(null);

    // Close modal on Escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && expandedExhibit !== null) {
                setExpandedExhibit(null);
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [expandedExhibit]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = expandedExhibit ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [expandedExhibit]);

    // Date range state - using actual Date objects [startDate, endDate]
    const today = startOfDay(new Date());
    const [dateRange, setDateRange] = useState([today, addDays(today, 31)])
    const [calendarText, setCalendarText] = useState('This month')

    // Search term state
    const [searchTerm, setSearchTerm] = useState('')

    // Single filters object to manage all filter states
    // const [filters, setFilters] = useReducer({
    //     venues: [],
    //     categories: [],
    //     paid: []
    // }, changeFilters)
    const [filters, setFilters] = useState({
        venues: [],
        categories: [],
        paid: []
    })

    // Fetch exhibitions from API
    useEffect(() => {
        fetch(API_URL)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch exhibitions');
                return res.json();
            })
            .then(data => {
                setExhibitions(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    // Calculate all unique filter options in one pass
    const filterOptions = useMemo(() => {
        if (!exhibitions.length) return null;

        const fields = ['venue', 'category', 'paid'];
        const options = {};

        fields.forEach(field => {
            options[field] = [...new Set(exhibitions.map(ex => ex[field]))].sort();
        });

        return options;
    }, [exhibitions]);

    // Initialize filters once when data loads
    useEffect(() => {
        if (filterOptions && !filtersInitialized.current) {
            setFilters({
                venues: filterOptions.venue,
                categories: filterOptions.category,
                paid: filterOptions.paid
            });
            filtersInitialized.current = true;
        }
    }, [filterOptions])

    const favouritesSet = useMemo(() => new Set(favourites), [favourites]);
    const visitedSet = useMemo(() => new Set(visited), [visited]);

    // Push a favourites/visited update to the API, debounced so rapid toggles
    // (e.g. clicking through several exhibits quickly) collapse into a single
    // request carrying the latest state, rather than one request per click.
    const syncUserData = useCallback((action, payload, timeoutRef) => {
        if (!userProfile?.idToken) {
            console.warn(`Skipping ${action} sync: not signed in`);
            return;
        }

        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            fetch('/api/user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Google-ID-Token': userProfile.idToken
                },
                body: JSON.stringify({ action, ...payload })
            }).catch(err => console.error('Failed to sync ' + action + ':', err));
        }, 800);
    }, [userProfile]);

    // Clear any pending sync timers on unmount
    useEffect(() => {
        return () => {
            clearTimeout(favouritesSyncTimeout.current);
            clearTimeout(visitedSyncTimeout.current);
            clearTimeout(prefSyncTimeout.current);
        };
    }, []);

    const handleFavouriteToggle = useCallback((title) => {
        setFavourites(prev => {
            const updated = prev.includes(title)
                ? prev.filter(t => t !== title)
                : [...prev, title];
            localStorage.setItem('favourites', JSON.stringify(updated));
            syncUserData('updateFavourites', { favourites: updated }, favouritesSyncTimeout);
            return updated;
        });
    }, [syncUserData]);
    const handleVisitToggle = useCallback((title) => {
        setVisited(prev => {
            const updated = prev.includes(title)
                ? prev.filter(t => t !== title)
                : [...prev, title];
            localStorage.setItem('visited', JSON.stringify(updated));
            syncUserData('updateVisited', { visited: updated }, visitedSyncTimeout);
            return updated;
        });
    }, [syncUserData]);

    const handleExpandExhibit = useCallback((title) => setExpandedExhibit(title), []);
    const handleCollapseExhibit = useCallback(() => setExpandedExhibit(null), []);

    // Calculate search relevance score for an exhibition
    // Field weights: venue (100) > title (50) > category (30) > description (20) > speakers (20)
    const calculateSearchScore = useCallback((exhibition, searchTerm) => {
        if (!searchTerm.trim()) return 0;

        const venueScore = fuzzyMatchScore(exhibition.venue, searchTerm) * 100;
        const titleScore = fuzzyMatchScore(exhibition.title, searchTerm) * 50;
        const categoryScore = fuzzyMatchScore(exhibition.category, searchTerm) * 30;
        const descScore = fuzzyMatchScore(exhibition.desc, searchTerm) * 20;
        const speakersScore = exhibition.speakers ? fuzzyMatchScore(exhibition.speakers, searchTerm) * 20 : 0;

        return venueScore + titleScore + categoryScore + descScore + speakersScore;
    }, []);

    // Filter and sort exhibitions based on all selected filters
    const filteredExhibitions = useMemo(() => {
        const rangeStart = dateRange[0] ? startOfDay(new Date(dateRange[0])) : null;
        const rangeEnd = dateRange[1] ? endOfDay(new Date(dateRange[1])) : null;

        if (filteringByFavourites) {
            return exhibitions.filter(ex => favouritesSet.has(ex.title));
        }

        const filtered = exhibitions
            .filter(ex => filters.venues.includes(ex.venue))
            .filter(ex => filters.categories.includes(ex.category))
            .filter(ex => filters.paid.includes(ex.paid))
            .filter(ex => {
                if (!rangeStart || !rangeEnd) return true;

                if (ex.dateRangeType == 'only' && ex.dates.length > 0) {
                    return ex.dates.some(d => isWithinInterval(startOfDay(parseISO(d)), { start: rangeStart, end: rangeEnd }))
                } else if (ex.dates && ex.dateRangeType == 'range' && ex.dates[0] !== null) {
                    if (!ex.dates) return true;
                    const exStart = startOfDay(parseISO(ex.dates[0]))
                    const exEnd = endOfDay(parseISO(ex.dates[ex.dates.length - 1]))
                    return exStart <= rangeEnd && exEnd >= rangeStart
                } else {
                    return false
                }
            })
        // .filter(ex => {
        //     if (!searchTerm.trim()) return true;
        //     return calculateSearchScore(ex, searchTerm) > 0;
        // });

        // if (searchTerm.trim()) {
        //     const scores = new Map(filtered.map(ex => [ex.title, calculateSearchScore(ex, searchTerm)]));
        //     return [...filtered].sort((a, b) => {
        //         const scoreA = scores.get(a.title);
        //         const scoreB = scores.get(b.title);
        //         if (scoreA !== scoreB) return scoreB - scoreA;
        //         return parseISO(a.dates[0]) - parseISO(b.dates[0]);
        //     });
        // }

        return [...filtered].sort((a, b) => {
            const aVisited = visitedSet.has(a.title);
            const bVisited = visitedSet.has(b.title);
            if (aVisited && !bVisited) return 1;
            if (!aVisited && bVisited) return -1;

            if (a.dates[0] === null && b.dates[0] !== null) return 1;
            if (a.dates[0] !== null && b.dates[0] === null) return -1;
            const startDiff = parseISO(a.dates[0]) - parseISO(b.dates[0]);
            if (startDiff !== 0) return startDiff;
            return parseISO(a.dates[a.dates.length - 1]) - parseISO(b.dates[b.dates.length - 1]);
        });
    }, [exhibitions, filters, dateRange, visitedSet, /* searchTerm, calculateSearchScore, */filteringByFavourites, favouritesSet])

    const toggleCalendar = () => {
        const calendar = document.querySelector('.calendar-date-picker')
        if (!calendar) return;
        if (calendar.style.display === 'flex') {
            calendar.style.display = 'none';
        } else {
            calendar.style.display = 'flex';
        }
    }
    const toggleFilters = () => {
        setFiltersExpanded(prev => !prev);
    }
    const toggleMap = () => {
        setMapExpanded(prev => !prev);
    }

    const handleCheckboxToggle = (filterType, value) => {
        setFilters(prev => {
            const current = prev[filterType];
            if (current.includes(value)) {
                return { ...prev, [filterType]: current.filter(v => v !== value) };
            } else {
                return { ...prev, [filterType]: [...current, value] };
            }
        });
    }

    if (loading) return <SkeletonLoader />
    if (error) return <p>Error loading exhibitions: {error}</p>
    if (!filterOptions) return null;

    return (
        <div>
            <img src={IMAGE_BASE_URL + 'headerlogo.png'} id='logo' />
            <NavBar
                onToggleFilters={toggleFilters}
                onToggleMap={toggleMap}
                onToggleCalendar={toggleCalendar}
                calendarText={calendarText}
                onSearch={setSearchTerm}
                userProfile={userProfile}
                setUserProfile={setUserProfile}
                setFavourites={setFavourites}
                setVisited={setVisited}
            />

            {/* Filter sidebar backdrop */}
            <div
                className={`filter-sidebar-backdrop${filtersExpanded ? ' visible' : ''}`}
                onClick={() => setFiltersExpanded(false)}
            />

            {/* Filter sidebar */}
            <div className={`filter-sidebar${filtersExpanded ? ' open' : ''}`}>
                <div className='filter-sidebar-header'>
                    <h3>Filters</h3>
                    <button className='filter-sidebar-close' onClick={() => setFiltersExpanded(false)}>×</button>
                </div>

                <div className='filter-section'>
                    <h4>Favourites</h4>
                    <label className='filter-checkbox-label'>
                        <input
                            type='checkbox'
                            checked={filteringByFavourites}
                            onChange={() => setFilteringByFavourites(!filteringByFavourites)}
                        />
                        Show only favourites
                    </label>
                </div>

                <div className='filter-section'>
                    <h4>Venue</h4>
                    {filterOptions.venue.map(venue => (
                        <label key={venue} className='filter-checkbox-label'>
                            <input
                                type='checkbox'
                                checked={filters.venues.includes(venue)}
                                onChange={() => handleCheckboxToggle('venues', venue)}
                            />
                            {venue}
                        </label>
                    ))}
                    {filters.venues.length > 0 ? (
                        <a className='filter-checkbox-label'
                            onClick={() => setFilters(prev => {
                                return { ...prev, venues: [] }
                            })}
                        >Remove All</a>
                    ) : (
                        <a className='filter-checkbox-label'
                            onClick={() => setFilters(prev => {
                                return { ...prev, venues: [...filterOptions.venue] }
                            })}
                        >Select All</a>
                    )}
                </div>

                <div className='filter-section'>
                    <h4>Entry</h4>
                    {filterOptions.paid.map(option => (
                        <label key={option} className='filter-checkbox-label'>
                            <input
                                type='checkbox'
                                checked={filters.paid.includes(option)}
                                onChange={() => handleCheckboxToggle('paid', option)}
                            />
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                        </label>
                    ))}
                </div>
            </div>
            <CalendarDatePicker
                value={dateRange}
                onChange={setDateRange}
                onPresetChange={setCalendarText}
            />

            {mapExpanded && mapInitialized && (
                <div className="map-container">
                    <VenueMap venues={venues} />
                </div>
            )}

            <div
                id='exhibits_container'
            >
                {filteredExhibitions.map((exhibition) =>
                    <Exhibit
                        key={exhibition.url || exhibition.title}
                        data={exhibition}
                        isExpanded={expandedExhibit === exhibition.title}
                        isFavourite={favouritesSet.has(exhibition.title)}
                        isVisited={visitedSet.has(exhibition.title)}
                        onExpand={handleExpandExhibit}
                        onCollapse={handleCollapseExhibit}
                        onFavouriteToggle={handleFavouriteToggle}
                        onVisitToggle={handleVisitToggle}
                    />
                )}
            </div>
            {showPreferences && (
                <SetPreferences
                    onSkip={() => setShowPreferences(false)}
                    onSave={(prefs) => {
                        localStorage.setItem('preferences', JSON.stringify(prefs));
                        syncUserData('updatePreferences', { preferences: prefs }, prefSyncTimeout);
                        setShowPreferences(false);
                    }}
                />
            )}
        </div>


    )
}

export default App
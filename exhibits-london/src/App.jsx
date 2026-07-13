import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { startOfDay, endOfDay, addDays, isWithinInterval, parseISO } from 'date-fns';
import './App.css'
import { Exhibit } from "./Exhibit";
import { CalendarDatePicker } from "./CalendarDatePicker";
import { NavBar } from "./NavBar";
import { SkeletonLoader } from "./SkeletonLoader";
import { IMAGE_BASE_URL } from "./constants";
import { VenueMap } from "./VenueMap";
import venues from "./venue_information.json"
import { SetPreferences } from "./SetPreferences.tsx";
import { FilterMenu } from "./FilterMenu.tsx";
import { ErrorBoundary } from "./ErrorBoundary";

// API endpoint to fetch exhibitions starting from today
const API_URL = '/api/exhibitions?startDate=' + startOfDay(new Date()).toISOString().split('T')[0]

/**
 * Custom hook to fetch exhibitions from the internal API.
 * Returns the exhibitions data, loading state, and any error encountered during fetch.
 * @returns {{ exhibitions: Array, loading: boolean, error: string|null }}
 */
const useExhibitions = () => {
    const [exhibitions, setExhibitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        fetch(API_URL)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch exhibitions');
                return res.json();
            })
            .then(data => {
                if (!cancelled) {
                    setExhibitions(data);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (!cancelled) {
                    setError(err.message);
                    setLoading(false);
                }
            });

        return () => { cancelled = true; };
    }, []);

    return { exhibitions, loading, error };
};

/**
 * Custom hook to handle user authentication state using Google Sign-In.
 * @returns 
 */
const useAuth = () => {
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
    return { userProfile, setUserProfile };
}

const getExhibitParam = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('exhibit');
};

const setExhibitParam = (identifier) => {
    const url = new URL(window.location.href);
    if (identifier) {
        url.searchParams.set('exhibit', identifier);
    } else {
        url.searchParams.delete('exhibit');
    }
    window.history.pushState({}, '', url);
};

function App() {
    const { exhibitions, loading, error } = useExhibitions();
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [mapExpanded, setMapExpanded] = useState(false);
    const [calendarExpanded, setCalendarExpanded] = useState(false);
    const [expandedExhibit, setExpandedExhibit] = useState(null);

    const [filteringByFavourites, setFilteringByFavourites] = useState(false);

    const [favourites, setFavourites] = useState(() => JSON.parse(localStorage.getItem('favourites') || '[]'));
    const [visited, setVisited] = useState(() => JSON.parse(localStorage.getItem('visited') || '[]'));
    const [preferences, setPreferences] = useState(() => JSON.parse(localStorage.getItem('preferences') || '[]'));
    const [showPreferences, setShowPreferences] = useState(preferences.length === 0);
    const { userProfile, setUserProfile } = useAuth();

    const favouritesSyncTimeout = useRef(null);
    const visitedSyncTimeout = useRef(null);
    const prefSyncTimeout = useRef(null);

    // Close modal on Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            setExpandedExhibit(null);
        }
        setExhibitParam(null);
    });

    // check for exhibit URL parameter
    useEffect(() => {
        if (exhibitions.length === 0) return

        const openExhibitId = getExhibitParam();
        if (!openExhibitId) return;

        const exhibit = exhibitions.find(ex => ex.id == openExhibitId);
        if (exhibit) {
            setExpandedExhibit(exhibit.id);
            document.body.classList.add('modal-open');
        }
    }, [exhibitions]);

    useEffect(() => {
        const handlePopState = () => {
            const openExhibitId = getExhibitParam();
            if (!openExhibitId) {
                setExpandedExhibit(null);
                document.body.classList.remove('modal-open');
                return;
            }

            const exhibit = exhibitions.find(ex => ex.id === openExhibitId);
            if (exhibit) {
                setExpandedExhibit(exhibit.id);
                document.body.classList.add('modal-open');
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [exhibitions]);

    // Date range state - using actual Date objects [startDate, endDate]
    const today = startOfDay(new Date());
    const [dateRange, setDateRange] = useState([today, addDays(today, 31)])
    const [calendarText, setCalendarText] = useState('This month')

    const [filters, setFilters] = useState({
        venues: [],
        categories: [],
        paid: []
    })

    // Calculate all unique filter options in one pass


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

    const handleExpandExhibit = useCallback((id) => {
        setExpandedExhibit(id);
        document.body.classList.add('modal-open');
        const exhibit = exhibitions.find(ex => ex.id === id);
        if (exhibit?.id) {
            setExhibitParam(exhibit.id);
        }
    }, [exhibitions]);
    const handleCollapseExhibit = useCallback(() => {
        setExpandedExhibit(null);
        document.body.classList.remove('modal-open');
        setExhibitParam(null);
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
    }, [exhibitions, filters, dateRange, visitedSet, filteringByFavourites, favouritesSet])

    if (loading) return <SkeletonLoader />
    if (error) return <p>Error loading exhibitions: {error}</p>

    return (
        <div>
            <img src={IMAGE_BASE_URL + 'headerlogo.png'} id='logo' />
            <NavBar
                toggleFilters={() => setFiltersExpanded(p => !p)}
                toggleMap={() => setMapExpanded(p => !p)}
                toggleCalendar={() => setCalendarExpanded(p => !p)}
                calendarText={calendarText}
                // onSearch={setSearchTerm}
                userProfile={userProfile}
                setUserProfile={setUserProfile}
                setFavourites={setFavourites}
                setVisited={setVisited}
                togglePreferences={() => setShowPreferences(p => !p)}
            />
            <FilterMenu
                exhibitions={exhibitions}
                filtersExpanded={filtersExpanded}
                setFiltersExpanded={setFiltersExpanded}
                filters={filters}
                setFilters={setFilters}
                filteringByFavourites={filteringByFavourites}
                setFilteringByFavourites={setFilteringByFavourites}
            />

            {calendarExpanded && (
                <CalendarDatePicker
                    value={dateRange}
                    onChange={setDateRange}
                    onPresetChange={setCalendarText}
                />
            )}

            {mapExpanded && (<VenueMap venues={venues} />)}

            <ErrorBoundary fallback={<p>Something went wrong while rendering the exhibits. Please try refreshing the page.</p>}>
                <div id='exhibits_container'>
                    {filteredExhibitions.map((exhibition) =>
                        <Exhibit
                            key={exhibition.id}
                            data={exhibition}
                            isExpanded={expandedExhibit === exhibition.id}
                            isFavourite={favouritesSet.has(exhibition.title)}
                            isVisited={visitedSet.has(exhibition.title)}
                            onExpand={handleExpandExhibit}
                            onCollapse={handleCollapseExhibit}
                            onFavouriteToggle={handleFavouriteToggle}
                            onVisitToggle={handleVisitToggle}
                        />
                    )}
                </div>
            </ErrorBoundary>

            {showPreferences && (
                <SetPreferences
                    onSkip={() => setShowPreferences(false)}
                    onSave={(prefs) => {
                        localStorage.setItem('preferences', JSON.stringify(prefs));
                        syncUserData('updatePreferences', { preferences: prefs }, prefSyncTimeout);
                        setPreferences(prefs);
                        setShowPreferences(false)
                    }}
                    preferences={preferences}
                />
            )}
        </div>
    )
}

export default App
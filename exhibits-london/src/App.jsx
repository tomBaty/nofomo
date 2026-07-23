import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { startOfDay, endOfDay, addDays, isWithinInterval, parseISO, differenceInCalendarDays } from 'date-fns';
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
import { ReviewsModal } from "./ReviewsModal";

// API endpoint to fetch exhibitions starting from today
const API_URL = '/api/exhibitions?startDate=' + startOfDay(new Date()).toISOString().split('T')[0]
const REVIEWS_URL = '/api/reviews/all';

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

    return { exhibitions, setExhibitions, loading, error };
};

/**
 * Custom hook to fetch all public reviews from the internal API.
 * @returns {{ reviews: Array, loading: boolean, error: string|null, refresh: () => void }}
 */
const useReviews = () => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadReviews = useCallback((onComplete) => {
        let cancelled = false;

        fetch(REVIEWS_URL)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch reviews');
                return res.json();
            })
            .then(data => {
                if (!cancelled) {
                    setReviews(data);
                    setLoading(false);
                    onComplete?.();
                }
            })
            .catch(err => {
                if (!cancelled) {
                    setError(err.message);
                    setLoading(false);
                    onComplete?.();
                }
            });

        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const cleanup = loadReviews();
        return cleanup;
    }, [loadReviews]);

    const refresh = useCallback(() => {
        setLoading(true);
        return loadReviews();
    }, [loadReviews]);

    return { reviews, loading, error, refresh };
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

        // Old sessions stored the raw Google ID token, which expires after ~1 hour.
        // Force those clients to sign in again so they receive a proper session token.
        if (!parsed.sessionId) {
            localStorage.removeItem("googleUserProfile");
            return null;
        }

        return parsed;
    });
    return { userProfile, setUserProfile };
}

const SCORE_WEIGHTS = {
    preferenceMatch: 20,
    visitedThemeMatch: 10,
    endingSoon: 30,
    favouriteEnding: 30,
    visitedPenalty: -150
};

const ENDING_SOON_WINDOW_DAYS = 365;

function getExhibitStartDate(exhibit) {
    if (!exhibit.dates || exhibit.dates.length === 0) return null;
    const first = exhibit.dates[0];
    if (first === null || first === undefined) return null;
    try {
        return parseISO(first);
    } catch {
        return null;
    }
}

function getExhibitEndDate(exhibit) {
    if (!exhibit.dates || exhibit.dates.length === 0) return null;

    const last = exhibit.dates[exhibit.dates.length - 1];
    if (last === null || last === undefined) return null;

    if (exhibit.dateRangeType === 'only' || exhibit.dateRangeType === 'range') {
        try {
            return parseISO(last);
        } catch {
            return null;
        }
    }

    return null;
}

function getDaysUntilEnd(exhibit, fromDate) {
    const endDate = getExhibitEndDate(exhibit);
    if (!endDate || isNaN(endDate.getTime())) return Infinity;
    const days = differenceInCalendarDays(endDate, fromDate);
    return days < 0 ? 0 : days;
}

function computeExhibitScore(exhibit, { preferenceSet, visitedThemesSet, favouritesSet, visitedSet, today }) {
    const themes = exhibit.themes || [];
    let score = 0;

    // Higher for each matching user preference theme.
    let preferenceMatches = 0;
    for (const theme of themes) {
        if (preferenceSet.has(theme)) preferenceMatches++;
    }
    score += preferenceMatches * SCORE_WEIGHTS.preferenceMatch;

    // Higher for themes the user has already shown interest in by visiting.
    let visitedThemeMatches = 0;
    for (const theme of themes) {
        if (visitedThemesSet.has(theme)) visitedThemeMatches++;
    }
    score += visitedThemeMatches * SCORE_WEIGHTS.visitedThemeMatch;

    // Ending-soon boost (all exhibitions).
    const daysUntilEnd = getDaysUntilEnd(exhibit, today);
    const endingFactor = daysUntilEnd === Infinity
        ? 0
        : Math.max(0, 1 - daysUntilEnd / ENDING_SOON_WINDOW_DAYS);
    score += endingFactor * SCORE_WEIGHTS.endingSoon;

    // Favourited exhibitions get a bigger boost the sooner they end.
    if (favouritesSet.has(exhibit.title)) {
        score += endingFactor * SCORE_WEIGHTS.favouriteEnding;
    }

    // Much lower if already visited.
    if (visitedSet.has(exhibit.title)) {
        score += SCORE_WEIGHTS.visitedPenalty;
    }

    return score;
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
    const { exhibitions, setExhibitions, loading, error } = useExhibitions();
    const { reviews, refreshReviews } = useReviews();
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [mapExpanded, setMapExpanded] = useState(false);
    const [calendarExpanded, setCalendarExpanded] = useState(false);
    const [expandedExhibit, setExpandedExhibit] = useState(null);

    const [filteringByFavourites, setFilteringByFavourites] = useState(false);
    const [filteringByVisited, setFilteringByVisited] = useState(false);
    const [showUserReviews, setShowUserReviews] = useState(false);
    

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
    const preferenceSet = useMemo(() => new Set(preferences), [preferences]);
    const visitedThemesSet = useMemo(() => {
        const set = new Set();
        for (const title of visited) {
            const exhibit = exhibitions.find(ex => ex.title === title);
            if (exhibit?.themes) {
                for (const theme of exhibit.themes) {
                    set.add(theme);
                }
            }
        }
        return set;
    }, [visited, exhibitions]);

    // Push a favourites/visited update to the API, debounced so rapid toggles
    // (e.g. clicking through several exhibits quickly) collapse into a single
    // request carrying the latest state, rather than one request per click.
    const syncUserData = useCallback((action, payload, timeoutRef) => {
        if (!userProfile?.sessionId) {
            console.warn(`Skipping ${action} sync: not signed in`);
            return;
        }

        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            fetch('/api/user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userProfile.sessionId}`
                },
                body: JSON.stringify({ action, ...payload })
            }).catch(err => console.error('Failed to sync ' + action + ':', err));
        }, 800);
    }, [userProfile]);

    const handleSignOut = useCallback(async () => {
        if (userProfile?.sessionId) {
            try {
                await fetch('/api/auth/session', {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${userProfile.sessionId}`
                    }
                });
            } catch (err) {
                console.error('Failed to delete session:', err);
            }
        }

        if (window.google?.accounts?.id) {
            window.google.accounts.id.disableAutoSelect();
        }

        localStorage.removeItem("googleUserProfile");
        setUserProfile(null);
    }, [userProfile, setUserProfile]);

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

    const handleExhibitUpdate = useCallback((id, updates) => {
        setExhibitions(prev => prev.map(ex => ex.id === id ? { ...ex, ...updates } : ex));
    }, [setExhibitions]);

    // Filter exhibitions by active filters, then rank them by a weighted score.
    const filteredExhibitions = useMemo(() => {
        const rangeStart = dateRange[0] ? startOfDay(new Date(dateRange[0])) : null;
        const rangeEnd = dateRange[1] ? endOfDay(new Date(dateRange[1])) : null;

        let filtered = exhibitions;

        if (filteringByFavourites || filteringByVisited) {
            if (filteringByFavourites) {
                filtered = filtered.filter(ex => favouritesSet.has(ex.title));
            }
            if (filteringByVisited) {
                filtered = filtered.filter(ex => visitedSet.has(ex.title));
            }
        } else {
            filtered = filtered
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
        }

        const scoringContext = { preferenceSet, visitedThemesSet, favouritesSet, visitedSet, today };

        return filtered
            .map(ex => ({ exhibit: ex, score: computeExhibitScore(ex, scoringContext) }))
            .sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }

                // Tie-break by start date (earlier first), then by end date.
                const aStart = getExhibitStartDate(a.exhibit);
                const bStart = getExhibitStartDate(b.exhibit);
                if (aStart && bStart) {
                    const startDiff = aStart - bStart;
                    if (startDiff !== 0) return startDiff;
                } else if (aStart && !bStart) {
                    return -1;
                } else if (!aStart && bStart) {
                    return 1;
                }

                const aEnd = getExhibitEndDate(a.exhibit);
                const bEnd = getExhibitEndDate(b.exhibit);
                if (aEnd && bEnd) {
                    return aEnd - bEnd;
                }
                return 0;
            })
            .map(({ exhibit }) => exhibit);
    }, [exhibitions, filters, dateRange, visitedSet, filteringByFavourites, filteringByVisited, favouritesSet, preferenceSet, visitedThemesSet, today])

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
                onSignOut={handleSignOut}
                onShowFavourites={() => setFilteringByFavourites(p => !p)}
                onShowVisited={() => setFilteringByVisited(p => !p)}
                onShowReviews={() => setShowUserReviews(true)}
            />
            <FilterMenu
                exhibitions={exhibitions}
                filtersExpanded={filtersExpanded}
                setFiltersExpanded={setFiltersExpanded}
                filters={filters}
                setFilters={setFilters}
                filteringByFavourites={filteringByFavourites}
                setFilteringByFavourites={setFilteringByFavourites}
                filteringByVisited={filteringByVisited}
                setFilteringByVisited={setFilteringByVisited}
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
                            userProfile={userProfile}
                            onExhibitUpdate={handleExhibitUpdate}
                            reviews={reviews}
                            onReviewSubmitted={refreshReviews}
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

            {showUserReviews && userProfile && (
                <ReviewsModal
                    mode='user'
                    userProfile={userProfile}
                    onClose={() => setShowUserReviews(false)}
                    exhibits={exhibitions}
                />
            )}
        </div>
    )
}

export default App
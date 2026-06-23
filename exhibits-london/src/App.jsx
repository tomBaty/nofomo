import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { startOfDay, endOfDay, addDays, isWithinInterval, parseISO } from 'date-fns';
import './App.css'
import { Exhibit } from "./Exhibit";
import { CalendarDatePicker } from "./CalendarDatePicker";
import { NavBar } from "./NavBar";
import { SkeletonLoader } from "./SkeletonLoader";

// API endpoint - works with Azure Functions locally and when deployed
const API_URL = '/api/exhibitions';

function App() {
    const [exhibitions, setExhibitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [error, setError] = useState(null);
    const [expandedExhibit, setExpandedExhibit] = useState(null); // Now stores title instead of index
    const [filteringByFavourites, setFilteringByFavourites] = useState(false);
    const filtersInitialized = useRef(false);
    const image_base_url = 'https://nofomodata.blob.core.windows.net/images/'

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

    // Date range state - using actual Date objects [startDate, endDate]
    const today = startOfDay(new Date());
    const [dateRange, setDateRange] = useState([today, addDays(today, 31)])
    const [calendarText, setCalendarText] = useState('This month')

    // Search term state
    const [searchTerm, setSearchTerm] = useState('')

    // Single filters object to manage all filter states
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

    // Generic toggle handler for all filter types
    const handleFilterToggle = (filterType, value) => {
        setFilters(prev => {
            // Check if clicking the same single selected item - if so, reset to all
            if (prev[filterType].length === 1 && prev[filterType][0] === value) {
                const fieldMap = {
                    venues: 'venue',
                    categories: 'category',
                    paid: 'paid'
                };
                return {
                    ...prev,
                    [filterType]: filterOptions[fieldMap[filterType]]
                }
            }
            // Otherwise, select only this item
            return {
                ...prev,
                [filterType]: [value]
            }
        })
    }

    // Fuzzy text matching function - returns a score from 0 to 1
    const fuzzyMatchScore = (text, searchTerm) => {
        if (!text || !searchTerm) return 0;
        const searchLower = searchTerm.toLowerCase().trim();
        const textLower = text.toLowerCase();

        // Perfect substring match gets highest score
        if (textLower === searchLower) return 1.0;

        // Direct substring match gets high score
        if (textLower.includes(searchLower)) {
            // Bonus for match at start of string
            if (textLower.startsWith(searchLower)) return 0.95;
            return 0.9;
        }

        // Fuzzy match - allow for typos and character variations
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

        // Return percentage of matched characters
        const matchPercentage = matchedChars / searchChars.length;

        // Only return score if at least 70% matched
        return matchPercentage >= 0.7 ? matchPercentage : 0;
    };

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

    // Filter exhibitions based on all selected filters
    const filteredExhibitions = useMemo(() => {
        const rangeStart = dateRange[0] ? startOfDay(new Date(dateRange[0])) : null;
        const rangeEnd = dateRange[1] ? endOfDay(new Date(dateRange[1])) : null;

        if (filteringByFavourites) {
            const favouritesFromLs = JSON.parse(localStorage.getItem('favourites') || '[]');
            const filtered = exhibitions.filter(ex => favouritesFromLs.includes(ex.title));
            return filtered;
        }

        return exhibitions
            .filter(ex => filters.venues.includes(ex.venue))
            .filter(ex => filters.categories.includes(ex.category))
            .filter(ex => filters.paid.includes(ex.paid))
            .filter(ex => {
                // Skip date filtering if no date range selected
                if (!rangeStart || !rangeEnd) return true;

                if (ex.dateRangeType == 'only' && ex.dates.length > 0) {
                    // Check if any date in ex.dates falls within the range
                    return ex.dates.some(d => {
                        // why is 2026 hard coded
                        return isWithinInterval(startOfDay(new Date(d)), { start: rangeStart, end: rangeEnd })
                    })
                } else if (ex.dates && ex.dateRangeType == 'range' && ex.dates[0] !== null) {
                    // Check for overlap between exhibition's date range and filter date range
                    if(!ex.dates) return true; // If no dates provided, include by default
                    const exStart = startOfDay(parseISO(ex.dates[0]))
                    const exEnd = endOfDay(parseISO(ex.dates[ex.dates.length - 1]))

                    return exStart <= rangeEnd && exEnd >= rangeStart
                } else {
                    return false
                }
            })
            .filter(ex => {
                // Apply search filter if search term exists
                if (!searchTerm.trim()) return true;

                // Include if search score is greater than 0
                return calculateSearchScore(ex, searchTerm) > 0;
            })
    }, [exhibitions, filters, dateRange, searchTerm, calculateSearchScore, filteringByFavourites])

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
            <img src={image_base_url + 'headerlogo.png'} id='logo' />
            <NavBar
                filteringByFavourites={filteringByFavourites}
                onToggleFavourites={() => setFilteringByFavourites(!filteringByFavourites)}
                onToggleFilters={toggleFilters}
                onToggleCalendar={toggleCalendar}
                calendarText={calendarText}
                onSearch={setSearchTerm}
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

            <div
                id='exhibits_container'
                key={`${JSON.stringify(filters)}-${searchTerm}-${dateRange[0]?.getTime()}-${dateRange[1]?.getTime()}-${filteringByFavourites}`}
            >
                {filteredExhibitions.sort((a, b) => {
                    // If search term exists, sort by search relevance score
                    if (searchTerm.trim()) {
                        const scoreA = calculateSearchScore(a, searchTerm);
                        const scoreB = calculateSearchScore(b, searchTerm);
                        if (scoreA !== scoreB) return scoreB - scoreA; // Higher score first
                    }

                    // Default sort by date
                    // if(!a.startDate || !a.endDate) return 1; // If a has no dates, sort it after b
                    // if(!b.startDate || !b.endDate) return -1; // If b has no dates, sort it after a
                    const startDiff = parseISO(a.dates[0]) - parseISO(b.dates[0]);
                    if (startDiff !== 0) return startDiff;
                    return parseISO(a.dates[a.dates.length - 1]) - parseISO(b.dates[b.dates.length - 1]);
                }).map((exhibition) =>
                    <Exhibit 
                        key={exhibition.url || exhibition.title} 
                        data={exhibition} 
                        densityMode={'dense'}
                        isExpanded={expandedExhibit === exhibition.title}
                        onExpand={() => setExpandedExhibit(exhibition.title)}
                        onCollapse={() => setExpandedExhibit(null)}
                    />
                )}
            </div>
        </div>
    )
}

export default App
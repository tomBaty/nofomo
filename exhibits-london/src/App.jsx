import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { startOfDay, endOfDay, addDays, isWithinInterval, parseISO } from 'date-fns';
import './App.css'
import { Exhibit } from "./Exhibit";
import { Filter } from "./Filter";
import { CalendarDatePicker } from "./CalendarDatePicker";
import { SearchBar } from "./SearchBar";
import { SkeletonLoader } from "./SkeletonLoader";

// API endpoint - works with Azure Functions locally and when deployed
const API_URL = '/api/exhibitions';

function App() {
    const [exhibitions, setExhibitions] = useState([]);
    const [loading, setLoading] = useState(true);
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
            console.log('Filtering by favourites:', { favouritesFromLs, filtered: filtered.length, exhibitions: exhibitions.length });
            return filtered;
        }

        return exhibitions
            .filter(ex => filters.venues.includes(ex.venue))
            .filter(ex => filters.categories.includes(ex.category))
            .filter(ex => filters.paid.includes(ex.paid))
            .filter(ex => {
                // Skip date filtering if no date range selected
                if (!rangeStart || !rangeEnd) return true;

                if (ex.dates && ex.dates.length > 0) {
                    // Check if any date in ex.dates falls within the range
                    return ex.dates.some(dateStr => {
                        const date = startOfDay(new Date(dateStr + ' 2026'))
                        return isWithinInterval(date, { start: rangeStart, end: rangeEnd })
                    })
                } else {
                    // Check for overlap between exhibition's date range and filter date range
                    if(!ex.startDate || !ex.endDate) return true; // If no dates provided, include by default
                    const exStart = startOfDay(parseISO(ex.startDate))
                    const exEnd = endOfDay(parseISO(ex.endDate))

                    return exStart <= rangeEnd && exEnd >= rangeStart
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
        const filtersContainer = document.getElementById('filters_container');
        if (!filtersContainer) return;
        if (filtersContainer.style.display === 'flex') {
            filtersContainer.style.display = 'none';
        } else {
            filtersContainer.style.display = 'flex';
        }
    }
    const heartIcon = <svg class="favouriteIcon" width="28" height="25" viewBox="0 0 28 25" fill={filteringByFavourites? "#e1251b" : "#7E7E7E" } xmlns="http://www.w3.org/2000/svg"><path d="M6.84559 0.0220063C7.37272 -0.055768 8.4797 0.0880607 8.99553 0.21255C11.2084 0.746537 12.8351 2.16176 14.0098 4.0194C14.43 3.19101 15.2011 2.37573 15.9154 1.77395C17.7619 0.218672 20.2465 -0.336749 22.6176 0.223417C24.1047 0.58096 25.4333 1.3997 26.4046 2.55706C28.0336 4.52884 28.1327 6.53321 27.9145 8.9461C27.5771 12.6742 25.4736 14.9563 22.7983 17.3585C22.189 17.9027 21.5712 18.4377 20.9449 18.9629C20.614 19.2439 20.2958 19.5286 19.9532 19.798C19.8795 19.8785 19.769 19.9572 19.6847 20.0318C19.476 20.2163 19.2526 20.3904 19.043 20.573L16.5009 22.7729C15.7666 23.4173 15.0466 24.0792 14.3257 24.7379C14.2368 24.8192 14.1198 24.9406 14.019 25C13.9366 24.9771 11.5359 22.8018 11.2499 22.5532L9.63024 21.1521L6.43659 18.4341C5.71731 17.8231 5.01345 17.195 4.32565 16.5504C2.58566 14.9069 1.23158 13.3455 0.512698 11.0328C0.281028 10.2804 0.132425 9.50593 0.0694166 8.72264C0.0244148 8.13134 -0.00550477 7.51444 0.000849696 6.92209C0.0348576 3.75552 2.23147 0.940284 5.4115 0.223013C5.90738 0.111171 6.33648 0.058723 6.84559 0.0220063Z"></path></svg>

    if (loading) return <SkeletonLoader />
    if (error) return <p>Error loading exhibitions: {error}</p>
    if (!filterOptions) return null;

    return (
        <div>
            <img src={image_base_url + 'headerlogo.png'} id='logo' />
            <div id='navbar'>
                <div id='filterToggle' onClick={toggleFilters}>
                    <img src={image_base_url + 'icon_filter.svg'} style={{ width: '20px', verticalAlign: 'middle' }} />
                </div>
                <div id='favouritesToggle' onClick={() => setFilteringByFavourites(!filteringByFavourites)}>
                    {heartIcon}
                </div>
                <SearchBar onSearch={setSearchTerm} />
                <div id='calendarToggle'
                    onClick={toggleCalendar}>
                    <button>
                        <img src={image_base_url + 'icon_calendar.svg'} style={{ width: '20px', marginRight: '10px', verticalAlign: 'middle' }} />
                        <p>{calendarText}</p>
                    </button>
                </div>
            </div>

            <div id='filters_container' style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', position: 'relative', padding: '20px', border: '0px' }}>
                <Filter items={filterOptions.venue}
                    selectedItems={filters.venues}
                    onToggle={(value) => handleFilterToggle('venues', value)}
                    label="Venues"
                    itemLabel="venues"
                />
                <Filter
                    items={filterOptions.category}
                    selectedItems={filters.categories}
                    onToggle={(value) => handleFilterToggle('categories', value)}
                    label="Categories"
                    itemLabel="categories"
                />
                <Filter
                    items={filterOptions.paid}
                    selectedItems={filters.paid}
                    onToggle={(value) => handleFilterToggle('paid', value)}
                    label="Paid"
                    itemLabel="paid"
                />
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
                    if(!a.startDate || !a.endDate) return 1; // If a has no dates, sort it after b
                    if(!b.startDate || !b.endDate) return -1; // If b has no dates, sort it after a
                    const startDiff = parseISO((a.startDate || a.dates[0])) - parseISO((b.startDate || b.dates[0]));
                    if (startDiff !== 0) return startDiff;
                    return parseISO((a.endDate || a.dates[a.dates.length - 1])) - parseISO((b.endDate || b.dates[b.dates.length - 1]));
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
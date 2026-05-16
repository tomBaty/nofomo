import { useState, useEffect, useMemo, useCallback } from "react";
import './App.css'
import { Exhibit } from "./Exhibit";
import { Filter } from "./Filter";
import { CalendarDatePicker } from "./CalendarDatePicker";
import { SearchBar } from "./SearchBar";

// API endpoint - works with Azure Functions locally and when deployed
const API_URL = '/api/exhibitions';

function App() {
    const [exhibitions, setExhibitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedExhibit, setExpandedExhibit] = useState(null);
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

    // Get unique venues and categories
    const venues = useMemo(() => {
        if (!exhibitions.length) return []
        return [...new Set(exhibitions.map(ex => ex.venue))].sort()
    }, [exhibitions])

    const categories = useMemo(() => {
        if (!exhibitions.length) return []
        return [...new Set(exhibitions.map(ex => ex.category))].sort()
    }, [exhibitions])

    const paid = useMemo(() => {
        if (!exhibitions.length) return []
        return [...new Set(exhibitions.map(ex => ex.paid))].sort()
    }, [exhibitions])

    // Date range state - using actual Date objects [startDate, endDate]
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const defaultEnd = new Date(today);
    defaultEnd.setDate(defaultEnd.getDate() + 31);

    const [dateRange, setDateRange] = useState([today, defaultEnd])
    const [calendarText, setCalendarText] = useState('This month')

    // Search term state
    const [searchTerm, setSearchTerm] = useState('')

    // Single filters object to manage all filter states
    const [filters, setFilters] = useState({
        venues: [],
        categories: [],
        paid: []
    })

    // Initialize filters when data loads
    useEffect(() => {
        if (venues.length > 0 && filters.venues.length === 0) {
            setFilters(prev => ({ ...prev, venues }))
        }
    }, [venues, filters.venues])

    useEffect(() => {
        if (categories.length > 0 && filters.categories.length === 0) {
            setFilters(prev => ({ ...prev, categories }))
        }
    }, [categories, filters.categories])

    useEffect(() => {
        if (filters.paid.length === 0) {
            setFilters(prev => ({ ...prev, paid }))
        }
    }, [paid, filters.paid])

    // Generic toggle handler for all filter types
    const handleFilterToggle = (filterType, value) => {
        setFilters(prev => {
            // Check if clicking the same single selected item - if so, reset to all
            if (prev[filterType].length === 1 && prev[filterType][0] === value) {
                const allItemsMap = {
                    venues: venues,
                    categories: categories,
                    paid: paid
                }
                return {
                    ...prev,
                    [filterType]: allItemsMap[filterType]
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
        const rangeStart = dateRange[0] ? new Date(dateRange[0]) : null;
        const rangeEnd = dateRange[1] ? new Date(dateRange[1]) : null;

        if (rangeStart) rangeStart.setHours(0, 0, 0, 0);
        if (rangeEnd) rangeEnd.setHours(23, 59, 59, 999);

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
                        const date = new Date(dateStr + ' 2026')
                        date.setHours(0, 0, 0, 0)
                        return date >= rangeStart && date <= rangeEnd
                    })
                } else {
                    // Check for overlap between exhibition's date range and filter date range
                    const exStart = new Date(ex.startDate)
                    exStart.setHours(0, 0, 0, 0)
                    const exEnd = new Date(ex.endDate)
                    exEnd.setHours(23, 59, 59, 999)

                    return exStart <= rangeEnd && exEnd >= rangeStart
                }
            })
            .filter(ex => {
                // Apply search filter if search term exists
                if (!searchTerm.trim()) return true;

                // Include if search score is greater than 0
                return calculateSearchScore(ex, searchTerm) > 0;
            })
    }, [exhibitions, filters, dateRange, searchTerm, calculateSearchScore])

    if (loading) return <p>Loading exhibitions...</p>
    if (error) return <p>Error loading exhibitions: {error}</p>

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

    return (
        <div>
            <img src={image_base_url + 'headerlogo.png'} id='logo' />
            <div id='navbar'>
                <div id='filterToggle' onClick={toggleFilters}>
                    <img src={image_base_url + 'icon_filter.svg'} style={{ width: '20px', verticalAlign: 'middle' }} />
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
                <Filter items={venues}
                    selectedItems={filters.venues}
                    onToggle={(value) => handleFilterToggle('venues', value)}
                    label="Venues"
                    itemLabel="venues"
                />
                <Filter
                    items={categories}
                    selectedItems={filters.categories}
                    onToggle={(value) => handleFilterToggle('categories', value)}
                    label="Categories"
                    itemLabel="categories"
                />
                <Filter
                    items={paid}
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
                key={`${JSON.stringify(filters)}-${searchTerm}-${dateRange[0]?.getTime()}-${dateRange[1]?.getTime()}`}
            >
                {filteredExhibitions.sort((a, b) => {
                    // If search term exists, sort by search relevance score
                    if (searchTerm.trim()) {
                        const scoreA = calculateSearchScore(a, searchTerm);
                        const scoreB = calculateSearchScore(b, searchTerm);
                        if (scoreA !== scoreB) return scoreB - scoreA; // Higher score first
                    }

                    // Default sort by date
                    const startDiff = new Date(a.startDate) - new Date(b.startDate);
                    if (startDiff !== 0) return startDiff;
                    return new Date(a.endDate) - new Date(b.endDate);
                }).map((exhibition, index) =>
                    <Exhibit 
                        key={index} 
                        data={exhibition} 
                        densityMode={'dense'}
                        isExpanded={expandedExhibit === index}
                        onExpand={() => setExpandedExhibit(index)}
                        onCollapse={() => setExpandedExhibit(null)}
                    />
                )}
            </div>
        </div>
    )
}

export default App
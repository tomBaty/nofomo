import { useState, useEffect, useMemo } from "react";
import './App.css'
import { Exhibit } from "./Exhibit";
import { Filter } from "./Filter";
import { Slider } from "./Slider";
import { SearchBar } from "./SearchBar";

// API endpoint - works with Azure Functions locally and when deployed
const API_URL = '/api/exhibitions';

function App() {
    const [exhibitions, setExhibitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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

    // Calculate date range (in days from today)
    // const { minDays, maxDays } = useMemo(() => {
    //     if (!exhibitions.length) return { minDays: 0, maxDays: 365 }
        
    //     const today = new Date()
    //     today.setHours(0, 0, 0, 0)
        
    //     const daysFromToday = exhibitions.map(ex => {
    //         const startDate = new Date(ex.startDate)
    //         startDate.setHours(0, 0, 0, 0)
    //         return Math.floor((startDate - today) / (1000 * 60 * 60 * 24))
    //     })
        
    //     return {
    //         minDays: Math.min(...daysFromToday),
    //         maxDays: Math.max(...daysFromToday)
    //     }
    // }, [exhibitions])
    const minDays = 0
    const maxDays = 365

    // Date range state - start with wide range to show all exhibitions initially
    const [dateRange, setDateRange] = useState([0, 31])
    
    // Search term state
    const [searchTerm, setSearchTerm] = useState('')

    // Initialize date range when data loads
    useEffect(() => {
        if (exhibitions.length > 0) {
            setDateRange([minDays, 31])
        }
    }, [minDays, maxDays, exhibitions.length])

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
    }, [categories, filters.paid])

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

    // Fuzzy text matching function
    const fuzzyMatch = (text, searchTerm) => {
        if (!text || !searchTerm) return false;
        const searchLower = searchTerm.toLowerCase().trim();
        const textLower = text.toLowerCase();
        
        // Direct substring match
        if (textLower.includes(searchLower)) return true;
        
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
        
        // Match if at least 70% of characters found in order
        return matchedChars / searchChars.length >= 0.7;
    };
    
    // Filter exhibitions based on all selected filters
    const filteredExhibitions = useMemo(() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const rangeStart = new Date(today)
        rangeStart.setDate(rangeStart.getDate() + dateRange[0])
        
        const rangeEnd = new Date(today)
        rangeEnd.setDate(rangeEnd.getDate() + dateRange[1])
        
        return exhibitions
            .filter(ex => filters.venues.includes(ex.venue))
            .filter(ex => filters.categories.includes(ex.category))
            .filter(ex => filters.paid.includes(ex.paid))
            .filter(ex => {
                if (ex.dates && ex.dates.length > 0) {
                    // Check if any date in ex.dates falls within the range
                    return ex.dates.some(dateStr => {
                        const date = new Date(dateStr)
                        date.setHours(0, 0, 0, 0)
                        return date >= rangeStart && date <= rangeEnd
                    })
                } else {
                    // Check for overlap between exhibition's date range and filter date range
                    const exStart = new Date(ex.startDate)
                    exStart.setHours(0, 0, 0, 0)
                    const exEnd = new Date(ex.endDate)
                    exEnd.setHours(0, 0, 0, 0)
                    
                    return exStart <= rangeEnd && exEnd >= rangeStart
                }
            })
            .filter(ex => {
                // Apply search filter if search term exists
                if (!searchTerm.trim()) return true;
                
                return fuzzyMatch(ex.title, searchTerm) ||
                       fuzzyMatch(ex.desc, searchTerm) ||
                       fuzzyMatch(ex.venue, searchTerm) ||
                       fuzzyMatch(ex.category, searchTerm);
            })
    }, [exhibitions, filters, dateRange, searchTerm])

    if (loading) return <p>Loading exhibitions...</p>
    if (error) return <p>Error loading exhibitions: {error}</p>

    return (
        <div>
            <h1>no<span style={{color: 'grey'}}>fomo</span>.london</h1>
            <SearchBar onSearch={setSearchTerm} />
            <p>Showing {filteredExhibitions.length} of {exhibitions.length} events</p>
            <div id='filters_container' style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', position: 'relative', padding: '20px', border: '0px' }}>
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
                <Slider
                    min={minDays}
                    max={maxDays}
                    value={dateRange}
                    onChange={setDateRange}
                    label="Date Range"
                    formatValue={(days) => {
                        const date = new Date()
                        date.setDate(date.getDate() + days)
                        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    }}
                    step={1}
                />
            </div>

            <div style={{ display: 'grid', gap: '20px', padding: '20px', gridTemplateColumns: '1fr 1fr' }}>
                {filteredExhibitions.sort((a, b) => {
                    const startDiff = new Date(a.startDate) - new Date(b.startDate);
                    if (startDiff !== 0) return startDiff;
                    return new Date(a.endDate) - new Date(b.endDate);
                }).map((exhibition, index) =>
                    <Exhibit key={index} data={exhibition} densityMode={'dense'}/>
                )}
            </div>
        </div>
    )
}

export default App

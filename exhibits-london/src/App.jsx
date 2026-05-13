import { useState, useEffect, useMemo } from "react";
import './App.css'
import { Exhibit } from "./Exhibit";
import { Filter } from "./Filter";
import { Slider } from "./Slider";

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
    const { minDays, maxDays } = useMemo(() => {
        if (!exhibitions.length) return { minDays: 0, maxDays: 365 }
        
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const daysFromToday = exhibitions.map(ex => {
            const startDate = new Date(ex.startDate)
            startDate.setHours(0, 0, 0, 0)
            return Math.floor((startDate - today) / (1000 * 60 * 60 * 24))
        })
        
        return {
            minDays: Math.min(...daysFromToday),
            maxDays: Math.max(...daysFromToday)
        }
    }, [exhibitions])

    // Date range state - start with wide range to show all exhibitions initially
    const [dateRange, setDateRange] = useState([0, 31])

    // Initialize date range when data loads
    useEffect(() => {
        if (exhibitions.length > 0) {
            setDateRange([minDays, maxDays])
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

    // Filter exhibitions based on all selected filters
    const filteredExhibitions = useMemo(() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        return exhibitions
            .filter(ex => filters.venues.includes(ex.venue))
            .filter(ex => filters.categories.includes(ex.category))
            .filter(ex => filters.paid.includes(ex.paid))
            .filter(ex => (new Date(ex.startDate) <= new Date(today) || ex.dates))
            // .filter(ex => {
            //     const startDate = new Date(ex.startDate? ex.startDate : ex.endDate)
            //     startDate.setHours(0, 0, 0, 0)
            //     const daysFromToday = Math.floor((startDate - today) / (1000 * 60 * 60 * 24))
            //     return daysFromToday >= dateRange[0] && daysFromToday <= dateRange[1]
            // })
    }, [exhibitions, filters, dateRange])

    if (loading) return <p>Loading exhibitions...</p>
    if (error) return <p>Error loading exhibitions: {error}</p>

    return (
        <div>
            <h1>What's happening in London?</h1>
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

            <div style={{ display: 'grid', gap: '20px', padding: '20px' }}>
                {filteredExhibitions.sort((a, b) => {
                    const startDiff = new Date(a.startDate) - new Date(b.startDate);
                    if (startDiff !== 0) return startDiff;
                    return new Date(a.endDate) - new Date(b.endDate);
                }).map((exhibition, index) =>
                    <Exhibit key={index} data={exhibition} densityMode={''}/>
                )}
            </div>
        </div>
    )
}

export default App

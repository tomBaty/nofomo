import { useMemo, useEffect, useRef } from 'react';
import type { Exhibition, FilterState } from './types'

interface FilterMenuProps {
    exhibitions: Exhibition[]
    filtersExpanded: boolean
    setFiltersExpanded: (value: boolean) => void
    filters: FilterState
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>
    filteringByFavourites: boolean
    setFilteringByFavourites: (value: boolean) => void
    filteringByVisited: boolean
    setFilteringByVisited: (value: boolean) => void
}

export function FilterMenu({
    exhibitions,
    filtersExpanded,
    setFiltersExpanded,
    filters,
    setFilters,
    filteringByFavourites,
    setFilteringByFavourites,
    filteringByVisited,
    setFilteringByVisited,
}: FilterMenuProps) {
    const filtersInitialized = useRef(false);

    const filterOptions = useMemo(() => {
        return {
            venue: [...new Set(exhibitions.map(ex => ex.venue))].sort(),
            category: [...new Set(exhibitions.map(ex => ex.category))].sort(),
            paid: [...new Set(exhibitions.map(ex => ex.paid))].sort(),
        }
    }, [exhibitions])

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
    }, [filterOptions, setFilters])

    const handleCheckboxToggle = (filterType: keyof FilterState, value: string) => {
        setFilters(prev => {
            const current = prev[filterType];
            if (current.includes(value)) {
                return { ...prev, [filterType]: current.filter(v => v !== value) };
            } else {
                return { ...prev, [filterType]: [...current, value] };
            }
        });
    }

    return (<>
        <div
            className={`filter-sidebar-backdrop${filtersExpanded ? ' visible' : ''}`}
            onClick={() => setFiltersExpanded(false)}
        />
        <div className={`filter-sidebar${filtersExpanded ? ' open' : ''}`}>
            <div className='filter-sidebar-header'>
                <h3>Filters</h3>
                <button className='filter-sidebar-close' onClick={() => setFiltersExpanded(false)}>×</button>
            </div>

            <div className='filter-section'>
                <h4>Your lists</h4>
                <label className='filter-checkbox-label'>
                    <input
                        type='checkbox'
                        checked={filteringByFavourites}
                        onChange={() => setFilteringByFavourites(!filteringByFavourites)}
                    />
                    Show only favourites
                </label>
                <label className='filter-checkbox-label'>
                    <input
                        type='checkbox'
                        checked={filteringByVisited}
                        onChange={() => setFilteringByVisited(!filteringByVisited)}
                    />
                    Show only visited
                </label>
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
        </div>
    </>);
}

import { SearchBar } from './SearchBar';
import './NavBar.css';
import { IMAGE_BASE_URL } from './constants';

export function NavBar({ onToggleFilters, onToggleCalendar, calendarText, onSearch }) {
    return (
        <div id='navbar'>
            <div id='filterToggle' onClick={onToggleFilters}>
                <img src={IMAGE_BASE_URL + 'icon_filter.svg'} style={{ width: '20px', verticalAlign: 'middle' }} />
            </div>
            <SearchBar onSearch={onSearch} />
            <div id='calendarToggle' onClick={onToggleCalendar}>
                <button>
                    <img src={IMAGE_BASE_URL + 'icon_calendar.svg'} style={{ width: '20px', marginRight: '10px', verticalAlign: 'middle' }} />
                    <p>{calendarText}</p>
                </button>
            </div>
        </div>
    )

}
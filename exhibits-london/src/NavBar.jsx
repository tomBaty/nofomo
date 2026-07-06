
import { SearchBar } from './SearchBar';
import { GoogleSignIn } from './GoogleSignIn';
import './NavBar.css';
import { IMAGE_BASE_URL } from './constants';

export function NavBar({ onToggleFilters, onToggleMap, onToggleCalendar, calendarText, onSearch, userProfile, setUserProfile, setFavourites, setVisited }) {
    return (
        <div id='navbar'>
            <div className='circleButton' id='filterToggle' onClick={onToggleFilters}>
                <img src={IMAGE_BASE_URL + 'icon_filter.svg'} style={{ width: '20px', verticalAlign: 'middle' }} />
                <p>Filters</p>
            </div>
            <div className='circleButton' id='mapToggle' onClick={onToggleMap}>
                <img src={IMAGE_BASE_URL + 'icon_map.svg'} style={{ width: '20px', verticalAlign: 'middle' }} />
                <p>View Map</p>
            </div>

            {/* <SearchBar onSearch={onSearch} /> */}
            <div className='circleButton' onClick={onToggleCalendar}>
                <img src={IMAGE_BASE_URL + 'icon_calendar.svg'} style={{ width: '20px', marginRight: '10px', verticalAlign: 'middle' }} />
                <p>{calendarText}</p>
            </div>
            <a href="/about/index.html" id="about-link">
                <div className='circleButton'>
                    <p>About the site</p>
                </div>
            </a>
            {userProfile ?
                <div className='circleButton' id='profileButton' href='/login'>
                    <img src={userProfile.profile.picture} style={{ width: '20px', verticalAlign: 'middle' }} />
                    <p>{userProfile.profile.given_name}</p>
                </div> :
                <GoogleSignIn setUserProfile={setUserProfile} userProfile={userProfile} setFavourites={setFavourites} setVisited={setVisited} />
            }
        </div>
    )

}
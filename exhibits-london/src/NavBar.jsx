
import { SearchBar } from './SearchBar';
import { GoogleSignIn } from './GoogleSignIn';
import './NavBar.css';
import { IMAGE_BASE_URL } from './constants';
import { useState } from 'react';

export function NavBar({ onToggleFilters, onToggleMap, onToggleCalendar, calendarText, onSearch }) {
    const [userProfile, setUserProfile] = useState(localStorage.getItem("googleUserProfile") ? JSON.parse(localStorage.getItem("googleUserProfile")) : null);

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

            {userProfile ?
                <div className='circleButton' id='profileButton' href='/login'>
                    <img src={userProfile.picture} style={{ width: '20px', verticalAlign: 'middle' }} />
                    <p>{userProfile.given_name}</p>
                </div> :
                <GoogleSignIn setUserProfile={setUserProfile} userProfile={userProfile} />
            }

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
        </div>
    )

}
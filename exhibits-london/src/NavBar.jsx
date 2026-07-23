
import { useState } from 'react';
// import { SearchBar } from './SearchBar';
import { GoogleSignIn } from './GoogleSignIn';
import { ProfileModal } from './ProfileModal';
import './NavBar.css';
import { IMAGE_BASE_URL } from './constants';

export function NavBar({ toggleFilters, toggleMap, toggleCalendar, calendarText, userProfile, setUserProfile, setFavourites, setVisited, togglePreferences, onSignOut, onShowFavourites, onShowVisited, onShowReviews }) {
    const [profileOpen, setProfileOpen] = useState(false);
    const [imageError, setImageError] = useState(false);

    const givenName = userProfile?.profile?.given_name || '';

    return (
        <>
            <section id='navbar' aria-label='Navigation'>
                <button className='circleButton' id='filterToggle' aria-label='Toggle Filters' onClick={toggleFilters}>
                    <img src={IMAGE_BASE_URL + 'icon_filter.svg'}/>
                    <p>Filters</p>
                </button>
                <button className='circleButton' id='mapToggle' aria-label='View Map' onClick={toggleMap}>
                    <img src={IMAGE_BASE_URL + 'icon_map.svg'}/>
                    <p>View Map</p>
                </button>

                {/* <SearchBar onSearch={onSearch} /> */}
                <button className='circleButton' aria-label='Toggle Calendar' onClick={toggleCalendar}>
                    <img src={IMAGE_BASE_URL + 'icon_calendar.svg'}/>
                    <p>{calendarText}</p>
                </button>
                {/* <a href="/about/index.html" id="about-link">
                    <div className='circleButton'>
                        <p>About the site</p>
                    </div>
                </a> */}
                {userProfile ?
                    <button className='circleButton' id='profileButton' aria-label='Open profile menu' onClick={() => setProfileOpen(true)}>
                        {userProfile.profile.picture && !imageError ? (
                            <img src={userProfile.profile.picture} alt={givenName} onError={() => setImageError(true)}/>
                        ) : (
                            <div className='navbar-profile-fallback'>
                                {givenName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <p>{givenName}</p>
                    </button> :
                    <GoogleSignIn setUserProfile={setUserProfile} userProfile={userProfile} setFavourites={setFavourites} setVisited={setVisited} />
                }
                <button className='circleButton' id='preferencesToggle' aria-label='View Preferences' onClick={togglePreferences}>
                    <p>Preferences</p>
                </button>
            </section>
            {profileOpen && (
                <ProfileModal
                    userProfile={userProfile}
                    onClose={() => setProfileOpen(false)}
                    onPreferences={togglePreferences}
                    onFavourites={onShowFavourites}
                    onVisited={onShowVisited}
                    onReviews={onShowReviews}
                    onSignOut={onSignOut}
                />
            )}
        </>
    )

}
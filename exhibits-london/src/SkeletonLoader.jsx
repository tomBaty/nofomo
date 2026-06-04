import './SkeletonLoader.css';
import { SearchBar } from "./SearchBar";

export function SkeletonLoader() {
    const image_base_url = 'https://nofomodata.blob.core.windows.net/images/'
    const heartIcon = <svg class="favouriteIcon" width="28" height="25" viewBox="0 0 28 25" fill="#7E7E7E" xmlns="http://www.w3.org/2000/svg"><path d="M6.84559 0.0220063C7.37272 -0.055768 8.4797 0.0880607 8.99553 0.21255C11.2084 0.746537 12.8351 2.16176 14.0098 4.0194C14.43 3.19101 15.2011 2.37573 15.9154 1.77395C17.7619 0.218672 20.2465 -0.336749 22.6176 0.223417C24.1047 0.58096 25.4333 1.3997 26.4046 2.55706C28.0336 4.52884 28.1327 6.53321 27.9145 8.9461C27.5771 12.6742 25.4736 14.9563 22.7983 17.3585C22.189 17.9027 21.5712 18.4377 20.9449 18.9629C20.614 19.2439 20.2958 19.5286 19.9532 19.798C19.8795 19.8785 19.769 19.9572 19.6847 20.0318C19.476 20.2163 19.2526 20.3904 19.043 20.573L16.5009 22.7729C15.7666 23.4173 15.0466 24.0792 14.3257 24.7379C14.2368 24.8192 14.1198 24.9406 14.019 25C13.9366 24.9771 11.5359 22.8018 11.2499 22.5532L9.63024 21.1521L6.43659 18.4341C5.71731 17.8231 5.01345 17.195 4.32565 16.5504C2.58566 14.9069 1.23158 13.3455 0.512698 11.0328C0.281028 10.2804 0.132425 9.50593 0.0694166 8.72264C0.0244148 8.13134 -0.00550477 7.51444 0.000849696 6.92209C0.0348576 3.75552 2.23147 0.940284 5.4115 0.223013C5.90738 0.111171 6.33648 0.058723 6.84559 0.0220063Z"></path></svg>

    return (
        <div>
            <img src={image_base_url + 'headerlogo.png'} id='logo' />
            <div id='navbar'>
                <div id='filterToggle'>
                    <img src={image_base_url + 'icon_filter.svg'} style={{ width: '20px', verticalAlign: 'middle' }} />
                </div>
                <div id='favouritesToggle'>
                    {heartIcon}
                </div>
                <SearchBar onSearch={() => {}} />
                <div id='calendarToggle'
                    onClick={() => {}}>
                    <button>
                        <img src={image_base_url + 'icon_calendar.svg'} style={{ width: '20px', marginRight: '10px', verticalAlign: 'middle' }} />
                        <p>This month</p>
                    </button>
                </div>
            </div>

            {/* Skeleton Exhibit Cards */}
            <div className="skeleton-exhibits">
                {[...Array(4)].map((_, index) => (
                    <div key={index} className="skeleton-exhibit-card">
                        <div className="skeleton skeleton-exhibit-image"></div>
                        <div className="skeleton-exhibit-content">
                            <div className="skeleton skeleton-title"></div>
                            <div className="skeleton skeleton-text"></div>
                            <div className="skeleton skeleton-text"></div>
                            <div className="skeleton skeleton-text-short"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

import { useMemo, useState } from 'react';
import venues from './venue_information.json'
import { IMAGE_BASE_URL } from './constants';
import { ReviewModal } from './ReviewModal';
import { AdminModal } from './AdminModal';

const heartIcon = <svg className='favouriteIcon' width="28" height="25" viewBox="0 0 28 25" fill="#7E7E7E" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.84559 0.0220063C7.37272 -0.055768 8.4797 0.0880607 8.99553 0.21255C11.2084 0.746537 12.8351 2.16176 14.0098 4.0194C14.43 3.19101 15.2011 2.37573 15.9154 1.77395C17.7619 0.218672 20.2465 -0.336749 22.6176 0.223417C24.1047 0.58096 25.4333 1.3997 26.4046 2.55706C28.0336 4.52884 28.1327 6.53321 27.9145 8.9461C27.5771 12.6742 25.4736 14.9563 22.7983 17.3585C22.189 17.9027 21.5712 18.4377 20.9449 18.9629C20.614 19.2439 20.2958 19.5286 19.9532 19.798C19.8795 19.8785 19.769 19.9572 19.6847 20.0318C19.476 20.2163 19.2526 20.3904 19.043 20.573L16.5009 22.7729C15.7666 23.4173 15.0466 24.0792 14.3257 24.7379C14.2368 24.8192 14.1198 24.9406 14.019 25C13.9366 24.9771 11.5359 22.8018 11.2499 22.5532L9.63024 21.1521L6.43659 18.4341C5.71731 17.8231 5.01345 17.195 4.32565 16.5504C2.58566 14.9069 1.23158 13.3455 0.512698 11.0328C0.281028 10.2804 0.132425 9.50593 0.0694166 8.72264C0.0244148 8.13134 -0.00550477 7.51444 0.000849696 6.92209C0.0348576 3.75552 2.23147 0.940284 5.4115 0.223013C5.90738 0.111171 6.33648 0.058723 6.84559 0.0220063Z" />
</svg>

const getMinPrice = (text) => {
    const matches = [...text.matchAll(/£\s?(\d+(?:\.\d{1,2})?)(?! donation)/g)];
    const prices = matches.map(m => parseFloat(m[1])).filter(p => p >= 1);
    return prices.length > 0 ? Math.min(...prices) : null;
};

const formatOpenHours = (hours) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const convertTime = (time) => {
        const hour = Math.floor(time);
        const minutes = Math.round((time - hour) * 60);
        const period = hour >= 12 ? 'pm' : 'am';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const timeStr = minutes > 0 ? `${displayHour}:${minutes.toString().padStart(2, '0')}${period}` : `${displayHour}${period}`;
        return timeStr;
    };

    if (!Array.isArray(hours) || hours.length === 0) return '';
    if (Array.isArray(hours[0])) {
        return hours.map((h, idx) => `${days[idx]} : ${(h[0] === 0 && h[1] === 0 ? 'Closed' : `${convertTime(h[0])} - ${convertTime(h[1])}`)}`).join(', ');
    }
    return '';
};

const openInNewTabIcon = <svg viewBox="0 0 164 164" fill="none" xmlns="http://www.w3.org/2000/svg" height="16" width="16">
    <path d="M158 55.5V13C158 9.13401 154.866 6 151 6H106.5" stroke="white" strokeWidth="23" strokeLinejoin="round"></path>
    <path d="M158 73V151C158 154.866 154.866 158 151 158H13C9.13401 158 6 154.866 6 151V13C6 9.13401 9.13401 6 13 6H86" stroke="white" strokeWidth="24" strokeLinejoin="round"></path>
    <path d="M154.5 9C154.5 9 111.532 51.968 84 79.5" stroke="white" strokeWidth="14" strokeLinejoin="round"></path>
</svg>

export function ExhibitModal({ exhibit, onCollapse, isFavourite, onFavouriteToggle, isVisited, onVisitToggle, formatDate, userProfile, onExhibitUpdate }) {
    const { exhibitTitle, exhibitSubtitle } = useMemo(() => {
        if (exhibit.title.length > 30) {
            const splitTitle = exhibit.title.split(/[:|]/);
            return { exhibitTitle: splitTitle[0], exhibitSubtitle: splitTitle[1] };
        } else {
            return { exhibitTitle: exhibit.title, exhibitSubtitle: null };
        }
    }, [exhibit.title]);

    const [priceExpanded, setPriceExpanded] = useState(false);
    const [venueExpanded, setVenueExpanded] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showAdminModal, setShowAdminModal] = useState(false);

    const isAdmin = userProfile?.userData.userRole === 'admin';

    const venue = venues.find(v => v.name === exhibit.venue);

    const venueInformation = (venue && (
        <div className='modal-venue-info'>
            <div className='venue-info-summary'>
                <strong>
                    About the {venue.category.toLowerCase()}
                </strong>
                <button className='venue-see-more-btn' onClick={(e) => { e.stopPropagation(); setVenueExpanded(v => !v); }}>
                    {venueExpanded ? 'See less' : 'See more'}
                </button>
            </div>
            <div className={`venue-info-detail${venueExpanded ? ' expanded' : ''}`}>
                <ul style={{ padding: '0' }}>
                    <li>{venue.address}</li>
                    <li>{venue.entryPrice == 0 ? 'Free entry' : `Standard entry price £${venue.entryPrice}`}</li>
                    <li style={{ marginTop: '10px' }}>{venue.description}</li>
                    <li style={{ fontWeight: '700', marginTop: '10px' }}>Open hours</li>
                    <table>
                        <tbody>
                            {formatOpenHours(venue.openHours).split(', ').map((oh, index) => (
                                <tr key={index}><td>{oh.split(' : ')[0]}</td><td>{oh.split(' : ')[1]}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </ul>
            </div>
        </div>
    ))
    const priceHasDetails = exhibit.priceInfo && exhibit.priceInfo.split('\n').filter(line => line.trim() !== '').length > 1;

    const priceInformation = (
        <div className='modal-price-info'>
            <div className='price-info-summary'>
                <strong>
                    {priceHasDetails
                        ? (() => { const min = getMinPrice(exhibit.priceInfo); return min ? `Entry from £${min}` : 'Price Information'; })()
                        : exhibit.paid.toLowerCase() === 'free' ? 'Free entry' : 'Price Information'}
                </strong>
                {priceHasDetails && (
                    <button className='price-see-more-btn' onClick={(e) => { e.stopPropagation(); setPriceExpanded(v => !v); }}>
                        {priceExpanded ? 'See less' : 'See more'}
                    </button>
                )}
            </div>
            {priceHasDetails ? (
                <div className={`price-info-detail${priceExpanded ? ' expanded' : ''}`}>
                    <div id='price-info-table'>
                        {exhibit.priceInfo.split('\n').filter(line => line.trim() !== '').map((line, index) => (
                            <div key={index} className='price-info-row'>
                                {line.split(':').map(p => <div key={p} className='price-info-cell'>{p.trim()}</div>)}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <p>{exhibit.paid.toLowerCase() === 'free' ? 'Free entry' : exhibit.priceInfo}</p>
            )}
        </div>
    )

    return <div
        className={`exhibit-modal-overlay `}
        onClick={onCollapse}
    >
        <div className='exhibit-modal-content' onClick={(e) => e.stopPropagation()}>
            <button className='modal-close-btn' onClick={onCollapse}>×</button>

            <div className='modal-header'>
                <div className='modal-title'>
                    <h2>{exhibitTitle}</h2>
                    {exhibitSubtitle && <h3>{exhibitSubtitle}</h3>}
                    <p style={{ textAlign: 'left', fontSize: '16px', marginTop: '10px' }}>{exhibit.venue}</p>
                    <div className='modal-date'>
                        <img src={IMAGE_BASE_URL + 'icon_calendar.svg'} alt='Calendar Icon' style={{ marginRight: '5px', width: '15px' }} />
                        <p style={{ textAlign: 'left', fontSize: '16px' }}>{formatDate(exhibit)}</p>
                    </div>
                    <div className='modal-view-official-site'>
                        {exhibit.url && (
                            <a
                                href={exhibit.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className='modal-cta-button'
                            >
                                View on official site {openInNewTabIcon}
                            </a>
                        )}
                        <div className='modal-fav-button' onClick={(e) => { e.stopPropagation(); onFavouriteToggle(exhibit.title); }}>{heartIcon} {isFavourite ? 'Favourited' : 'Add to Favourites'}</div>
                        <div className='modal-fav-button' onClick={(e) => { e.stopPropagation(); onVisitToggle(exhibit.title); }}>{ } {isVisited ? 'Visited' : 'Mark as Visited'}</div>
                        {userProfile && (
                            <div className='modal-fav-button' onClick={(e) => { e.stopPropagation(); setShowReviewModal(true); }}>Review</div>
                        )}
                        {isAdmin && (
                            <div className='modal-fav-button' onClick={(e) => { e.stopPropagation(); setShowAdminModal(true); }}>Admin</div>
                        )}
                    </div>

                </div>
            </div>

            <div className='modal-body'>
                {venueInformation}
                {priceInformation}

                <div className='modal-description'>
                    {exhibit.speakers && (
                        <div className='modal-info-item'>
                            <strong>Speakers</strong>
                            <p><em>{exhibit.speakers}</em></p>
                        </div>
                    )}
                    {exhibit.descriptionHTML ? (
                        <div dangerouslySetInnerHTML={{ __html: exhibit.descriptionHTML }} />
                    ) : (
                        <p style={{ whiteSpace: 'pre-wrap' }}>{exhibit.description.replace(/([a-zA-Z])\.([A-Z])/g, '$1. $2')}</p>
                    )}
                </div>
            </div>
            {showReviewModal && (
                <ReviewModal
                    exhibit={exhibit}
                    userProfile={userProfile}
                    onClose={() => setShowReviewModal(false)}
                />
            )}
            {showAdminModal && (
                <AdminModal
                    exhibit={exhibit}
                    userProfile={userProfile}
                    onClose={() => setShowAdminModal(false)}
                    onDeleted={onCollapse}
                    onUpdated={onExhibitUpdate}
                />
            )}
        </div>
    </div >
}
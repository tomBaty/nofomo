


import { memo, useState, useMemo } from 'react';
import { parseISO } from 'date-fns';
import { IMAGE_BASE_URL } from './constants';
import venues from './venue_information.json'

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
        return hours.map((h, idx) => `${days[idx]} : ${convertTime(h[0])} - ${convertTime(h[1])}`).join(', ');
    }
    return '';
};

const clockIcon = <svg width="16" height="16" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="91" stroke="white" strokeWidth="18" />
    <path d="M99.5 44V102L128 123.5" stroke="white" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
</svg>;

const openInNewTabIcon = <svg viewBox="0 0 164 164" fill="none" xmlns="http://www.w3.org/2000/svg" height="16" width="16">
    <path d="M158 55.5V13C158 9.13401 154.866 6 151 6H106.5" stroke="white" stroke-width="23" stroke-linejoin="round"></path>
    <path d="M158 73V151C158 154.866 154.866 158 151 158H13C9.13401 158 6 154.866 6 151V13C6 9.13401 9.13401 6 13 6H86" stroke="white" stroke-width="24" stroke-linejoin="round"></path>
    <path d="M154.5 9C154.5 9 111.532 51.968 84 79.5" stroke="white" stroke-width="14"></path>
</svg>

export const Exhibit = memo(function Exhibit({ data, isExpanded, isFavourite, isVisited, onExpand, onCollapse, onFavouriteToggle, onVisitToggle }) {
    const [priceExpanded, setPriceExpanded] = useState(false);
    const [venueExpanded, setVenueExpanded] = useState(false);

    const heartIcon = useMemo(() => <svg className='favouriteIcon' width="28" height="25" viewBox="0 0 28 25" fill={isFavourite ? "#e1251b" : "#7E7E7E"} xmlns="http://www.w3.org/2000/svg">
        <path d="M6.84559 0.0220063C7.37272 -0.055768 8.4797 0.0880607 8.99553 0.21255C11.2084 0.746537 12.8351 2.16176 14.0098 4.0194C14.43 3.19101 15.2011 2.37573 15.9154 1.77395C17.7619 0.218672 20.2465 -0.336749 22.6176 0.223417C24.1047 0.58096 25.4333 1.3997 26.4046 2.55706C28.0336 4.52884 28.1327 6.53321 27.9145 8.9461C27.5771 12.6742 25.4736 14.9563 22.7983 17.3585C22.189 17.9027 21.5712 18.4377 20.9449 18.9629C20.614 19.2439 20.2958 19.5286 19.9532 19.798C19.8795 19.8785 19.769 19.9572 19.6847 20.0318C19.476 20.2163 19.2526 20.3904 19.043 20.573L16.5009 22.7729C15.7666 23.4173 15.0466 24.0792 14.3257 24.7379C14.2368 24.8192 14.1198 24.9406 14.019 25C13.9366 24.9771 11.5359 22.8018 11.2499 22.5532L9.63024 21.1521L6.43659 18.4341C5.71731 17.8231 5.01345 17.195 4.32565 16.5504C2.58566 14.9069 1.23158 13.3455 0.512698 11.0328C0.281028 10.2804 0.132425 9.50593 0.0694166 8.72264C0.0244148 8.13134 -0.00550477 7.51444 0.000849696 6.92209C0.0348576 3.75552 2.23147 0.940284 5.4115 0.223013C5.90738 0.111171 6.33648 0.058723 6.84559 0.0220063Z" />
    </svg>, [isFavourite]);


    const formatDateRange = (startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(23, 0, 0, 0); // Reset time to compare just dates

        const startDay = start.getDate();
        const endDay = end.getDate();
        const startMonth = start.toLocaleString('en-GB', { month: 'short' });
        const endMonth = end.toLocaleString('en-GB', { month: 'short' });
        const startYear = start.getFullYear();
        const endYear = end.getFullYear();

        // If exhibition has already started, show "Current"
        if (start <= today) {
            return `Ends ${endDay} ${endMonth}`;
        }

        if (startYear !== endYear) {
            return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
        } else if (startMonth === endMonth) {
            return `${startDay} - ${endDay} ${startMonth} ${endYear}`;
        } else {
            return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${endYear}`;
        }
    }
    const formatSingleDate = (date) => {
        if (!date) return 'Unknown date';
        const d = new Date(date);
        const day = d.getDate();
        const month = d.toLocaleString('en-GB', { month: 'long' });
        const year = d.getFullYear();
        if (d.toDateString() === new Date().toDateString()) {
            return 'Today';
        } else if (d.toDateString() === new Date(new Date().setDate(new Date().getDate() + 1)).toDateString()) {
            return 'Tomorrow';
        }
        if (!date.match(/20{2}\d/)) {
            return `${day} ${month}`;
        }
        return `${day} ${month} ${year}`;
    }
    const formatMultipleDates = (dates) => {
        if (dates.length === 1) {
            return formatSingleDate(dates[0]);
        }
        const datesAreConsecutive = dates.every((date, index) => {
            if (index === 0) return true;
            const diffInDays = (new Date(date).getTime() - new Date(dates[index - 1]).getTime()) / (1000 * 3600 * 24);
            return diffInDays === 1;
        })

        if (datesAreConsecutive) {
            const year = new Date().getFullYear();
            return formatDateRange(dates[0] + ` ${year}`, dates[dates.length - 1] + ` ${year}`);
        }

        if (dates.length <= 4) {
            return dates.map(date => formatSingleDate(date)).join(', ')
        }
        return 'Various dates ' + formatSingleDate(dates[0]) + ' - ' + formatSingleDate(dates[dates.length - 1]);
    }

    const formatDate = (data) => {
        if (data.dateRangeType == 'only' && data.dates.length > 0) {
            return formatMultipleDates(data.dates);
        } else if (data.dateRangeType == 'only' && data.dates.length === 1) {
            return formatSingleDate(data.dates[0]);
        } else {
            return formatDateRange(data.dates[0], data.dates[1]);
        }
    }

    const formatTitle = (title) => {
        if (title.includes(':') && title.length > 30) {
            return [<h2 style={{ fontWeight: 'bold', fontSize: '20px', marginBottom: 0 }}>{data.title.split(':')[0]}</h2>, <h3>{data.title.split(':')[1]}</h3>]
        } else if (title.includes('|') && title.length > 30) {
            return [<h2 style={{ fontWeight: 'bold', fontSize: '20px', marginBottom: 0 }}>{data.title.split('|')[0]}</h2>, <h3>{data.title.split('|')[1]}</h3>]
        }
        return [<h2 style={{ fontWeight: 'bold', fontSize: '20px' }}>{data.title}</h2>]
    }

    const venue = venues.find(v => v.name === data.venue);

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
                <ul style={{ padding: '0'}}>
                    <li>{venue.address}</li>
                    <li>{venue.entryPrice == 0 ? 'Free entry' : `Standard entry price £${venue.entryPrice}`}</li>
                    <li style={{ fontWeight: '700', marginTop: '10px'}}>Open hours</li>
                    <table>
                    {formatOpenHours(venue.openHours).split(', ').map((oh, index) => (
                        <tr key={index}><td>{oh.split(' : ')[0]}</td><td>{oh.split(' : ')[1]}</td></tr>
                    ))}
                    </table>
                </ul>
            </div>
        </div>
    ))
    const priceInformation = (data.priceInfo && data.priceInfo.split('\n').filter(line => line.trim() !== '').length > 1 ? (
        <div className='modal-price-info'>
            <div className='price-info-summary'>
                <strong>
                    {(() => { const min = getMinPrice(data.priceInfo); return min ? `Entry from £${min}` : 'Price Information'; })()}
                </strong>
                <button className='price-see-more-btn' onClick={(e) => { e.stopPropagation(); setPriceExpanded(v => !v); }}>
                    {priceExpanded ? 'See less' : 'See more'}
                </button>
            </div>
            <div className={`price-info-detail${priceExpanded ? ' expanded' : ''}`}>
                <ul>{data.priceInfo.split('\n').filter(line => line.trim() !== '').map((line, index) => (
                    <li key={index}>{line}</li>
                ))}</ul>
            </div>
        </div>
    ) : (<div className='modal-price-info'><p>{data.paid.toLowerCase() === 'free' ? 'Free entry' : data.priceInfo}</p></div>))

    return (
        <>
            <div
                className={'exhibit' + (new Date(data.startDate) > new Date() ? ' notYetOpen' : '') + (isExpanded ? ' exhibit-expanded' : '')}
                onClick={() => onExpand(data.title)}
            >
                <div className='card_icon_container'>
                    <img src={IMAGE_BASE_URL + data.icon} alt={data.category} />
                </div>
                <div className='title_section'>
                    <div>
                        <div className='title_section_title'>
                            {formatTitle(data.title)[0]}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {(data.dates && data.dates[data.dates.length - 1] !== null) && parseISO(data.dates[data.dates.length - 1]).getTime() < (Date.now() + 7 * 24 * 60 * 60 * 1000) && (
                                    <div className='endsSoonLabel'>{clockIcon}</div>
                                )}
                                <div onClick={(e) => { e.stopPropagation(); onFavouriteToggle(data.title); }} style={{ alignSelf: 'start' }}>{heartIcon}</div>
                                {/* <div onClick={(e) => { e.stopPropagation(); onVisitToggle(data.title); }} style={{ alignSelf: 'start' }}>{heartIcon}</div> */}
                            </div>
                        </div>
                        {formatTitle(data.title)[1]}
                        <div style={{ display: 'inline-flex', flexDirection: 'row', columnGap: '15px', flexWrap: 'wrap' }}>
                            <p style={{ display: 'flex' }}><img src={IMAGE_BASE_URL + 'icon_location_red.svg'} alt='Location Icon' style={{ marginRight: '5px', width: '9px', marginTop: '2px' }} />{data.venue}</p>
                            <p style={{ display: 'flex' }}><img src={IMAGE_BASE_URL + 'icon_calendar.svg'} alt='Calendar Icon' style={{ marginRight: '5px', width: '15px' }} />{formatDate(data)}</p>
                        </div>
                    </div>
                </div>
                <div className='details_section'>
                    {data.speakers ? <p><em>{data.speakers}</em></p> : null}
                    <p>{data.shortDescription}</p>
                    <a href={data.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        View Details →
                    </a>
                </div>

            </div >

            {isExpanded && (
                <div
                    className={`exhibit-modal-overlay `}
                    onClick={onCollapse}
                >
                    <div className='exhibit-modal-content' onClick={(e) => e.stopPropagation()}>
                        <button className='modal-close-btn' onClick={onCollapse}>×</button>

                        <div className='modal-header'>
                            <div className='modal-title'>
                                {data.title.includes(':') && data.title.length > 30 ?
                                    <><h2>{data.title.split(':')[0]}</h2><h3>{data.title.split(':')[1]}</h3></> :
                                    <h2>{data.title}</h2>}
                                <p style={{ textAlign: 'left', fontSize: '16px', marginTop: '10px' }}>{data.venue}</p>
                                <div className='modal-date' style={{ display: 'flex', alignItems: 'center', marginTop: '5px' }}>
                                    <img src={IMAGE_BASE_URL + 'icon_calendar.svg'} alt='Calendar Icon' style={{ marginRight: '5px', width: '15px' }} />
                                    <p style={{ textAlign: 'left', fontSize: '16px' }}>{formatDate(data)}</p>
                                </div>
                                <div style={{ flexWrap: 'wrap', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                                    {data.url && (
                                        <a
                                            href={data.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className='modal-cta-button'
                                        >
                                            View on official site {openInNewTabIcon}
                                        </a>
                                    )}
                                    <div className='modal-fav-button' onClick={(e) => { e.stopPropagation(); onFavouriteToggle(data.title); }}>{heartIcon} {isFavourite ? 'Favourited' : 'Add to Favourites'}</div>
                                    <div className='modal-fav-button' onClick={(e) => { e.stopPropagation(); onVisitToggle(data.title); }}>{} {isVisited ? 'Visited' : 'Mark as Visited'}</div>
                                </div>

                            </div>
                        </div>

                        <div className='modal-body'>
                            {venueInformation}
                            {priceInformation}
                            
                            <div className='modal-description'>
                                {data.speakers && (
                                    <div className='modal-info-item'>
                                        <strong>Speakers</strong>
                                        <p><em>{data.speakers}</em></p>
                                    </div>
                                )}
                                {data.descriptionHTML ? (
                                    <div dangerouslySetInnerHTML={{ __html: data.descriptionHTML }} />
                                ) : (
                                    <p style={{ whiteSpace: 'pre-wrap' }}>{data.description.replace(/([a-zA-Z])\.([A-Z])/g, '$1. $2')}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div >
            )
            }
        </>
    )
})
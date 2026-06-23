


import { useEffect, useRef, useState, useMemo } from 'react';

export function Exhibit({ data, densityMode, isExpanded, onExpand, onCollapse }) {
    const cardRef = useRef(null);
    const [isFavourite, setIsFavourite] = useState(JSON.parse(localStorage.getItem('favourites') || '[]').includes(data.title));
    const [priceExpanded, setPriceExpanded] = useState(false);

    const getMinPrice = (text) => {
        const matches = [...text.matchAll(/£\s?(\d+(?:\.\d{1,2})?)/g)];
        const prices = matches.map(m => parseFloat(m[1])).filter(p => p >= 1);
        return prices.length > 0 ? Math.min(...prices) : null;
    };
    const image_base_url = 'https://nofomodata.blob.core.windows.net/images/'

    const heartIcon = useMemo(() => <svg className='favouriteIcon' width="28" height="25" viewBox="0 0 28 25" fill={isFavourite ? "#e1251b" : "#7E7E7E"} xmlns="http://www.w3.org/2000/svg">
        <path d="M6.84559 0.0220063C7.37272 -0.055768 8.4797 0.0880607 8.99553 0.21255C11.2084 0.746537 12.8351 2.16176 14.0098 4.0194C14.43 3.19101 15.2011 2.37573 15.9154 1.77395C17.7619 0.218672 20.2465 -0.336749 22.6176 0.223417C24.1047 0.58096 25.4333 1.3997 26.4046 2.55706C28.0336 4.52884 28.1327 6.53321 27.9145 8.9461C27.5771 12.6742 25.4736 14.9563 22.7983 17.3585C22.189 17.9027 21.5712 18.4377 20.9449 18.9629C20.614 19.2439 20.2958 19.5286 19.9532 19.798C19.8795 19.8785 19.769 19.9572 19.6847 20.0318C19.476 20.2163 19.2526 20.3904 19.043 20.573L16.5009 22.7729C15.7666 23.4173 15.0466 24.0792 14.3257 24.7379C14.2368 24.8192 14.1198 24.9406 14.019 25C13.9366 24.9771 11.5359 22.8018 11.2499 22.5532L9.63024 21.1521L6.43659 18.4341C5.71731 17.8231 5.01345 17.195 4.32565 16.5504C2.58566 14.9069 1.23158 13.3455 0.512698 11.0328C0.281028 10.2804 0.132425 9.50593 0.0694166 8.72264C0.0244148 8.13134 -0.00550477 7.51444 0.000849696 6.92209C0.0348576 3.75552 2.23147 0.940284 5.4115 0.223013C5.90738 0.111171 6.33648 0.058723 6.84559 0.0220063Z" />
    </svg>, [isFavourite]);

    const toggleFavourite = () => {
        var favourites = JSON.parse(localStorage.getItem('favourites') || '[]');
        if (favourites.includes(data.title)) {
            favourites = favourites.filter(title => title !== data.title);
        } else {
            favourites.push(data.title);
        }
        setIsFavourite(!isFavourite);
        localStorage.setItem('favourites', JSON.stringify(favourites));
    }

    // Capture card position before expanding
    const handleExpand = () => {
        if (cardRef.current) {
            onExpand();
        }
    };

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isExpanded) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isExpanded]);

    const formatDateRange = (startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(23, 0, 0, 0); // Reset time to compare just dates

        const startDay = start.getDate();
        const endDay = end.getDate();
        const startMonth = start.toLocaleString('en-GB', { month: 'long' });
        const endMonth = end.toLocaleString('en-GB', { month: 'long' });
        const startYear = start.getFullYear();
        const endYear = end.getFullYear();

        // If exhibition has already started, show "Current"
        if (start <= today) {
            return `Current - ${endDay} ${endMonth} ${endYear}`;
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
            return formatDateRange(dates[0] + ' 2026', dates[dates.length - 1] + ' 2026');
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

    const clockIcon = <svg width="20" height="20" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="91" stroke="white" stroke-width="18" />
        <path d="M99.5 44V102L128 123.5" stroke="white" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" />
    </svg>

    return (
        <>
            <div
                ref={cardRef}
                className={'exhibit' + (densityMode ? ' dense' : '') + (new Date(data.startDate) > new Date() ? ' notYetOpen' : '') + (isExpanded ? ' exhibit-expanded' : '')}
                onClick={handleExpand}
            >
                <div className='card_icon_container'>
                    <img style={{ width: '100%' }} src={image_base_url + data.icon} alt={data.category} />
                </div>
                <div className='title_section'>
                    <div>
                        {data.title.includes(':') && data.title.length > 30 ? <><h2 style={{ fontWeight: 'bold', fontSize: '20px', marginBottom: 0 }}>{data.title.split(':')[0]}</h2><h3>{data.title.split(':')[1]}</h3></> :
                            <h2 style={{ fontWeight: 'bold', fontSize: '20px' }}>{data.title}</h2>}
                        <p style={{ display: 'flex' }}><img src={image_base_url + 'icon_location_red.svg'} alt='Location Icon' style={{ marginRight: '10px', width: '10px' }} />{data.venue}</p>
                        <p style={{ display: 'flex' }}><img src={image_base_url + 'icon_calendar.svg'} alt='Calendar Icon' style={{ marginRight: '5px', width: '15px' }} />{formatDate(data)}</p>

                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <div onClick={(e) => { e.stopPropagation(); toggleFavourite(); }}>{heartIcon}</div>
                        {data.dates && new Date(data.dates[data.dates.length - 1]) < (new Date().getTime() + 7 * 24 * 60 * 60 * 1000) && (
                            <div className='endsSoonLabel'>{clockIcon}</div>
                        )}
                    </div>

                </div>
                <div className='details_section'>
                    {data.speakers ? <p><em>{data.speakers}</em></p> : null}
                    <p>{data.shortDescription}</p>
                    <a href={data.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        View Details →
                    </a>
                </div>

            </div>

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
                                    <img src={image_base_url + 'icon_calendar.svg'} alt='Calendar Icon' style={{ marginRight: '5px', width: '15px' }} />
                                    <p style={{ textAlign: 'left', fontSize: '16px' }}>{formatDate(data)}</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                                    {data.url && (
                                        <a
                                            href={data.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className='modal-cta-button'
                                        >
                                            View on official site 🡽
                                        </a>
                                    )}
                                    <div className='modal-fav-button' onClick={(e) => { e.stopPropagation(); toggleFavourite(); }}>{heartIcon} Favourite</div>
                                </div>

                            </div>
                        </div>

                        <div className='modal-body'>
                            {data.priceInfo && data.priceInfo.split('\n').length > 1 ? (
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
                                        <ul>{data.priceInfo.split('\n').map((line, index) => (
                                            <li key={index}>{line}</li>
                                        ))}</ul>
                                    </div>
                                </div>
                            ) : (<div className='modal-price-info'><p>{data.paid.toLowerCase() === 'free' ? 'Free entry' : data.priceInfo}</p></div>)}

                            <div className='modal-description'>
                                {data.speakers && (
                                    <div className='modal-info-item'>
                                        <strong>Speakers</strong>
                                        <p><em>{data.speakers}</em></p>
                                    </div>
                                )}
                                <p style={{ whiteSpace: 'pre-wrap' }}>{data.description}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
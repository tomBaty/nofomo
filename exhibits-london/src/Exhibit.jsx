


import { useEffect, useRef, useState } from 'react';

export function Exhibit({ data, densityMode, isExpanded, onExpand, onCollapse }) {
    const cardRef = useRef(null);
    const [cardPosition, setCardPosition] = useState(null);
    const [isAnimating, setIsAnimating] = useState(false);

    // Capture card position before expanding
    const handleExpand = () => {
        if (cardRef.current) {
            const rect = cardRef.current.getBoundingClientRect();
            setCardPosition({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            });
            setIsAnimating(true);
            onExpand();
            
            // Reset animating state after animation completes
            setTimeout(() => setIsAnimating(false), 400);
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

    const selectIcon = (data) => {
        // Combine all text fields to search
        const searchText = [
            data.title || '',
            data.desc || '',
            data.category || ''
        ].join(' ').toLowerCase();

        // Define icon keywords with priority order (more specific first)
        const iconRules = [
            { keywords: ['sculpture', 'sculpt', 'statue', 'sculptor'], icon: 'icon_sculpture.png' },
            
            { keywords: ['dinosaur', 'fossil', 'prehistoric', 'dino'], icon: 'icon_dino.svg' },
            { keywords: ['cinema', 'film', 'movie', 'screening'], icon: 'icon_cinema.svg' },
            { keywords: ['climate', 'environment', 'sustainability', 'ecology'], icon: 'icon_climate.png' },
            { keywords: ['photograph', 'photography', 'photo'], icon: 'icon_photo.png' },
            { keywords: ['vase', 'pottery', 'ceramic', 'porcelain'], icon: 'icon_vase.png' },
            { keywords: ['jazz'], icon: 'icon_jazz.png' },
            { keywords: ['orchestra', 'classical', 'symphony'], icon: 'icon_cello.svg' },
            { keywords: ['music', 'concert', 'cello', 'musical'], icon: 'icon_music.png' },
            { keywords: ['drama', 'theatre', 'theater', 'play', 'performance', 'shakespeare'], icon: 'icon_drama.svg' },
            { keywords: ['talk', 'lecture', 'speaker', 'discussion', 'seminar', 'conversation'], icon: 'icon_speaker.svg' },
            { keywords: ['painting', 'painter', 'portrait', 'landscape', 'watercolor', 'art'], icon: 'icon_painting.svg' }
        ];

        // Find the first matching icon rule
        for (const rule of iconRules) {
            if (rule.keywords.some(keyword => searchText.includes(keyword))) {
                return rule.icon;
            }
        }

        return {
            'Tate Modern': 'icon_painting.svg',
            'Natural History Museum': 'icon_dino.svg',
            'Barbican': 'icon_cinema.svg',
            'British Museum': 'icon_vase.png',
            'Tate Britain': 'icon_painting.svg',
            'Royal Albert Hall': 'icon_music.png',
            'National Gallery': 'icon_painting.svg',
            'London School of Economics': 'icon_speaker.svg',
            'Science Museum': 'icon_photo.png',
            'Victoria and Albert Museum': 'icon_sculpture.png',
        }[data.venue]
    };

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
        if(!date) return 'Unknown date';
        const d = new Date(date);
        const day = d.getDate();
        const month = d.toLocaleString('en-GB', { month: 'long' });
        const year = d.getFullYear();
        if(d.toDateString() === new Date().toDateString()) {
            return 'Today';
        } else if (d.toDateString() === new Date(new Date().setDate(new Date().getDate() + 1)).toDateString()) {
            return 'Tomorrow';
        }
        if(!date.match(/20{2}\d/)) {
            return `${day} ${month}`;
        }
        return `${day} ${month} ${year}`;
    }
    const formatMultipleDates = (dates) => {
        if(dates.length === 1) {
            return formatSingleDate(dates[0]);
        }
        const datesAreConsecutive  = dates.every((date, index) => {
            if (index === 0) return true;
            const diffInDays = (new Date(date).getTime() - new Date(dates[index - 1]).getTime()) / (1000 * 3600 * 24);
            return diffInDays === 1;
        })
        if(datesAreConsecutive) {
            return formatDateRange(dates[0] + ' 2026', dates[dates.length - 1] + ' 2026');
        }
        const formattedDates = dates.map(date => formatSingleDate(date));
        return formattedDates.join(', ');
    }

    const formatDate = (data) => {
        if(data.dates && data.dates.length > 0) {
            return formatMultipleDates(data.dates);
        } else if(new Date(data.startDate).toDateString() === new Date(data.endDate).toDateString()) {
            return formatSingleDate(data.startDate);
        } else {
            return formatDateRange(data.startDate, data.endDate);
        }
    }

    const getSmallestPoundPriceInText = (text) => {
        const poundRegex = /£\s?(\d+)/g;
        let match;
        let minPrice = Infinity;
        while ((match = poundRegex.exec(text)) !== null) {
            const price = parseInt(match[1], 10);
            if (price < minPrice && price >= 5) { // Ignore very low prices which are likely to be errors
                minPrice = price;
            }
        }
        return minPrice === Infinity ? `Either free or price not released` : `from £${minPrice}`;
    }

    const getLabels = (data) => {
        var labels = [];
        if (data.paid === 'free') {
            labels.push(['Free entry', 'green']);
        } else {
            const priceLabel = getSmallestPoundPriceInText(data.priceInfo);
            if(priceLabel !== 'Either free or price not released') {
                labels.push([priceLabel, 'orange']);
            }
        }

        if(data.dates && data.dates.length > 0) {
            return labels
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time for accurate day comparison
        const startDate = new Date(data.startDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(data.endDate);
        endDate.setHours(0, 0, 0, 0);
        
        const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        const daysUntilStart = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
        
        // Ending soon: event is ongoing or ending within 14 days
        if (endDate > today && daysUntilEnd <= 14 && startDate.toDateString() !== endDate.toDateString()) {
            labels.push(['Ending soon', 'red']);
        }
        
        // Opening soon: event hasn't started yet and starts within 30 days
        if (startDate > today && daysUntilStart <= 30 && startDate.toDateString() !== endDate.toDateString()) {
            labels.push(['Opening soon', 'blue']);
        }
        
        return labels
    }

    return (
        <>
            <div 
                ref={cardRef}
                className={'exhibit' + (densityMode ? ' dense' : '') + (new Date(data.startDate) > new Date() ? ' notYetOpen' : '') + (isExpanded ? ' exhibit-expanded' : '')}
                onClick={handleExpand}
                style={{ cursor: 'pointer' }}
            >
                <div className='card_icon_container'>
                    <img style={{width: '100%'}} src={'/assets/' + selectIcon(data)} alt={data.category} />
                </div>
                <div className='title_section'>
                    {data.title.includes(':') && data.title.length > 30 ? <><h2 style={{fontWeight: 'bold', fontSize: '20px', marginBottom: 0}}>{data.title.split(':')[0]}</h2><h3>{data.title.split(':')[1]}</h3></> :
                        <h2 style={{fontWeight: 'bold', fontSize: '20px'}}>{data.title}</h2>}
                </div>
                <div className='details_section'>
                    <div className='labels'>{getLabels(data).map(label => <span key={label[0]} className='label' style={{backgroundColor: label[1]}}>{label[0]}</span>)}</div>
                    <p><strong>{data.venue}</strong> · {formatDate(data)}</p>
                    {data.speakers? <p><em>{data.speakers}</em></p> : null}
                    <p>{data.desc}</p>
                    <a href={data.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        View Details →
                    </a>
                </div>
            </div>

            {isExpanded && cardPosition && (
                <div 
                    className={`exhibit-modal-overlay ${isAnimating ? 'animating' : ''}`}
                    onClick={onCollapse}
                    style={{
                        '--card-top': `${cardPosition.top}px`,
                        '--card-left': `${cardPosition.left}px`,
                        '--card-width': `${cardPosition.width}px`,
                        '--card-height': `${cardPosition.height}px`
                    }}
                >
                    <div className='exhibit-modal-content' onClick={(e) => e.stopPropagation()}>
                        <button className='modal-close-btn' onClick={onCollapse}>×</button>
                        
                        <div className='modal-header'>
                            <div className='modal-icon-container'>
                                <img src={'/assets/' + selectIcon(data)} alt={data.category} />
                            </div>
                            <div className='modal-title'>
                                {data.title.includes(':') && data.title.length > 30 ? 
                                    <><h2>{data.title.split(':')[0]}</h2><h3>{data.title.split(':')[1]}</h3></> :
                                    <h2>{data.title}</h2>}
                            </div>
                        </div>

                        <div className='modal-body'>
                            <div className='labels'>{getLabels(data).map(label => <span key={label[0]} className='label' style={{backgroundColor: label[1]}}>{label[0]}</span>)}</div>
                            
                            <div className='modal-info-grid'>
                                <div className='modal-info-item'>
                                    <strong>Venue</strong>
                                    <p>{data.venue}</p>
                                </div>
                                <div className='modal-info-item'>
                                    <strong>Date</strong>
                                    <p>{formatDate(data)}</p>
                                </div>
                                {data.category && (
                                    <div className='modal-info-item'>
                                        <strong>Category</strong>
                                        <p>{data.category}</p>
                                    </div>
                                )}
                                {data.speakers && (
                                    <div className='modal-info-item'>
                                        <strong>Speakers</strong>
                                        <p><em>{data.speakers}</em></p>
                                    </div>
                                )}
                            </div>

                            <div className='modal-description'>
                                <strong>Description</strong>
                                <p>{data.desc}</p>
                            </div>

                            {data.priceInfo && (
                                <div className='modal-price-info'>
                                    <strong>Price Information</strong>
                                    <p>{data.priceInfo}</p>
                                </div>
                            )}

                            <a 
                                href={data.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className='modal-cta-button'
                            >
                                View Full Details on Official Site →
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
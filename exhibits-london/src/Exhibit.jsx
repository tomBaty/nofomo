


export function Exhibit({ data, densityMode }) {
    let categoryToIconMap = {
        'Tate Modern': {
            'Exhibition': 'icon_painting.svg',

        },
        'London School Of Economics': {
            'Talk': 'icon_speaker.svg'
        },
        'Globe Theatre': {
            'Performance': 'icon_drama.svg'
        },
        'Barbican': {
            'Exhibition': 'icon_painting.svg',
            'Performance': 'icon_drama.svg',
            'Cinema': 'icon_cinema.svg',
            'Contemporary music': 'icon_cello.svg',
            'Classical music': 'icon_cello.svg',
        },
        'Natural History Museum': {
            'Exhibition': 'icon_dino.svg'
        }
    }

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
        <div className={'exhibit' + (densityMode ? ' dense' : '') + (new Date(data.startDate) > new Date() ? ' notYetOpen' : '')}>
            <div class='card_icon_container'>
                <img style={{width: '100%'}} src={'/assets/' + (categoryToIconMap[data.venue]?.[data.category] || 'icon_painting.svg')} alt={data.category} />
            </div>
            <div class='card_content'>
                {data.title.includes(':') && data.title.length > 30 ? <><h2 style={{fontWeight: 'bold', fontSize: '20px', marginBottom: 0}}>{data.title.split(':')[0]}</h2><h3>{data.title.split(':')[1]}</h3></> :
                    <h2 style={{fontWeight: 'bold', fontSize: '20px'}}>{data.title}</h2>}

                <div className='labels'>{getLabels(data).map(label => <span key={label[0]} className='label' style={{backgroundColor: label[1]}}>{label[0]}</span>)}</div>
                <p><strong>{data.venue}</strong> · {formatDate(data)}</p>
                {data.speakers? <p><em>{data.speakers}</em></p> : null}
                <p>{data.desc}</p>
                <a href={data.url} target="_blank" rel="noopener noreferrer">
                    View Details →
                </a>
            </div>
            
        </div>
    )
}
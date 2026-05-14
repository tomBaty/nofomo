import { useState } from 'react';
import './CalendarDatePicker.css';

export function CalendarDatePicker({ value, onChange, onPresetChange }) {
    // value is expected to be [startDate, endDate] where dates are Date objects or null
    const [startDate, endDate] = value || [null, null];
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [isSelectingEnd, setIsSelectingEnd] = useState(false);

    // Get array of dates for a given month
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        
        // Get day of week for first day (0 = Sunday, 1 = Monday, etc.)
        const startDayOfWeek = firstDay.getDay();
        // Convert to Monday-first (0 = Monday, 6 = Sunday)
        const startDayMondayFirst = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
        
        const days = [];
        
        // Add empty slots for days before month starts
        for (let i = 0; i < startDayMondayFirst; i++) {
            days.push(null);
        }
        
        // Add all days in month
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(new Date(year, month, day));
        }
        
        return days;
    };

    // Get next month's date
    const getNextMonth = (date) => {
        const newDate = new Date(date);
        newDate.setMonth(newDate.getMonth() + 1);
        return newDate;
    };

    // Navigate months
    const goToPreviousMonth = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const firstOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        const newDate = new Date(currentMonth);
        newDate.setMonth(newDate.getMonth() - 1);
        
        // Don't go before the current month
        if (newDate >= firstOfCurrentMonth) {
            setCurrentMonth(newDate);
        }
    };

    const goToNextMonth = () => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(newDate.getMonth() + 1);
        setCurrentMonth(newDate);
    };
    
    // Check if we can go to previous month
    const canGoPrevious = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const firstOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const firstOfDisplayedMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        return firstOfDisplayedMonth > firstOfCurrentMonth;
    };

    // Handle date selection
    const handleDateClick = (date) => {
        if (!date) return;
        
        // Don't allow selecting dates before today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date < today) return;

        if (!startDate || (startDate && endDate)) {
            // Starting new selection
            onChange([date, null]);
            setIsSelectingEnd(true);
        } else if (isSelectingEnd) {
            // Selecting end date
            if (date < startDate) {
                // If end date is before start, swap them
                onChange([date, startDate]);
            } else {
                onChange([startDate, date]);
            }
            setIsSelectingEnd(false);
        }
    };

    // Check if date is in range
    const isInRange = (date) => {
        if (!date || !startDate || !endDate) return false;
        const time = date.getTime();
        return time >= startDate.getTime() && time <= endDate.getTime();
    };

    // Check if date is start or end
    const isStartDate = (date) => {
        if (!date || !startDate) return false;
        return date.toDateString() === startDate.toDateString();
    };

    const isEndDate = (date) => {
        if (!date || !endDate) return false;
        return date.toDateString() === endDate.toDateString();
    };

    // Check if date is today
    const isToday = (date) => {
        if (!date) return false;
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };
    
    // Check if date is in the past
    const isPastDate = (date) => {
        if (!date) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);
        return checkDate < today;
    };

    // Render a single month
    const renderMonth = (monthDate) => {
        const days = getDaysInMonth(monthDate);
        const monthName = monthDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

        return (
            <div className="calendar-month">
                <div className="calendar-month-header">
                    {monthName}
                </div>
                <div className="calendar-weekdays">
                    <div className="calendar-weekday">Mon</div>
                    <div className="calendar-weekday">Tue</div>
                    <div className="calendar-weekday">Wed</div>
                    <div className="calendar-weekday">Thu</div>
                    <div className="calendar-weekday">Fri</div>
                    <div className="calendar-weekday">Sat</div>
                    <div className="calendar-weekday">Sun</div>
                </div>
                <div className="calendar-grid">
                    {days.map((date, index) => {
                        if (!date) {
                            return <div key={`empty-${index}`} className="calendar-day empty"></div>;
                        }

                        const inRange = isInRange(date);
                        const isStart = isStartDate(date);
                        const isEnd = isEndDate(date);
                        const today = isToday(date);
                        const isPast = isPastDate(date);

                        return (
                            <div
                                key={date.toISOString()}
                                className={`calendar-day ${inRange ? 'in-range' : ''} ${isStart ? 'start-date' : ''} ${isEnd ? 'end-date' : ''} ${today ? 'today' : ''} ${isPast ? 'disabled' : ''}`}
                                onClick={() => handleDateClick(date)}
                            >
                                {date.getDate()}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const nextMonth = getNextMonth(currentMonth);

    // Preset date ranges
    const handlePresetClick = (preset) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let start, end;

        switch (preset) {
            case 'Today':
                start = new Date(today);
                end = new Date(today);
                break;
            case 'Tomorrow':
                start = new Date(today);
                start.setDate(start.getDate() + 1);
                end = new Date(start);
                break;
            case 'This Weekend': {
                // Find next Saturday and Sunday
                start = new Date(today);
                const daysUntilSaturday = (6 - start.getDay() + 7) % 7 || 7;
                start.setDate(start.getDate() + daysUntilSaturday);
                end = new Date(start);
                end.setDate(end.getDate() + 1);
                break;
            }
            case 'Next 2 Weeks':
                start = new Date(today);
                end = new Date(today);
                end.setDate(end.getDate() + 14); // 2 weeks = 14 days
                break;
            case 'This Month':
                start = new Date(today);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'Next 2 Months':
                start = new Date(today);
                end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
                break;
            case 'All':
                start = new Date(today);
                end = new Date(today);
                end.setFullYear(end.getFullYear() + 4);
                break;
            default:
                return;
        }
        onPresetChange(preset);

        onChange([start, end]);
        setIsSelectingEnd(false);
    };

    return (
        <div className="calendar-date-picker">
            <div className="calendar-presets">
                <button className="preset-button" onClick={() => handlePresetClick('Today')}>
                    Today
                </button>
                <button className="preset-button" onClick={() => handlePresetClick('Tomorrow')}>
                    Tomorrow
                </button>
                <button className="preset-button" onClick={() => handlePresetClick('This Weekend')}>
                    This Weekend
                </button>
                <button className="preset-button" onClick={() => handlePresetClick('Next 2 Weeks')}>
                    Next 2 Weeks
                </button>
                <button className="preset-button" onClick={() => handlePresetClick('This Month')}>
                    This Month
                </button>
                <button className="preset-button" onClick={() => handlePresetClick('Next 2 Months')}>
                    Next 2 Months
                </button>
                <button className="preset-button" onClick={() => handlePresetClick('All')}>
                    All
                </button>
            </div>
            <div className="calendar-navigation">
                <button 
                    className="calendar-nav-button" 
                    onClick={goToPreviousMonth}
                    disabled={!canGoPrevious()}
                >
                    ‹
                </button>
                <div className="calendar-months">
                    {renderMonth(currentMonth)}
                    {renderMonth(nextMonth)}
                </div>
                <button className="calendar-nav-button" onClick={goToNextMonth}>
                    ›
                </button>
            </div>
        </div>
    );
}

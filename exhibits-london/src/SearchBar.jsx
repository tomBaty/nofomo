import { useState } from 'react';
import './SearchBar.css';

export function SearchBar({ onSearch }) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const handleButtonClick = () => {
        if (!isExpanded) {
            setIsExpanded(true);
            setTimeout(() => {
                document.querySelector('.search-input').focus();
            }, 0);
        } else {
            onSearch(searchTerm);
        }
    };

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            onSearch(searchTerm);
        }
    };

    const handleClear = () => {
        setSearchTerm('');
        onSearch('');
        setIsExpanded(false);
    };

    return (
        <div className="search-bar-container">
            <div className={`search-bar ${isExpanded ? 'expanded' : ''}`} onClick={handleButtonClick}>
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search exhibitions, venues, themes..."
                    value={searchTerm}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    disabled={!isExpanded}
                />
                <button 
                    className="search-button" 
                    aria-label="Search"
                >
                    <svg 
                        className="search-icon" 
                        width="20" 
                        height="20" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                </button>
                {isExpanded && searchTerm && (
                    <button 
                        className="clear-button" 
                        onClick={handleClear}
                        aria-label="Clear search"
                    >
                        ×
                    </button>
                )}
            </div>
        </div>
    );
}

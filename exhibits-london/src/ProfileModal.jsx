import { useEffect, useState } from 'react';

export function ProfileModal({ userProfile, onClose, onPreferences, onFavourites, onVisited, onReviews, onSignOut }) {
    const [imageError, setImageError] = useState(false);

    const givenName = userProfile?.profile?.given_name || 'User';
    const familyName = userProfile?.profile?.family_name || '';
    const picture = userProfile?.profile?.picture;
    const email = userProfile?.profile?.email;

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const handleAction = (action) => {
        action();
        onClose();
    };

    const renderAvatar = () => {
        if (picture && !imageError) {
            return (
                <img
                    src={picture}
                    alt={givenName}
                    className='profile-modal-avatar'
                    onError={() => setImageError(true)}
                />
            );
        }
        const initial = givenName.charAt(0).toUpperCase();
        return (
            <div className='profile-modal-avatar profile-modal-avatar-fallback'>
                {initial}
            </div>
        );
    };

    return (
        <div className='admin-modal-overlay' onClick={onClose}>
            <div className='admin-modal-content profile-modal-content' onClick={(e) => e.stopPropagation()}>
                <button className='admin-modal-close-btn' onClick={onClose}>×</button>
                <div className='profile-modal-header'>
                    {renderAvatar()}
                    <div className='profile-modal-user-info'>
                        <h2>{givenName} {familyName}</h2>
                        {email && <p className='profile-modal-email'>{email}</p>}
                    </div>
                </div>
                <div className='admin-action-list'>
                    <button className='admin-action-btn' onClick={() => handleAction(onPreferences)}>
                        Preferences
                    </button>
                    <button className='admin-action-btn' onClick={() => handleAction(onFavourites)}>
                        Favourites
                    </button>
                    <button className='admin-action-btn' onClick={() => handleAction(onVisited)}>
                        Visited
                    </button>
                    <button className='admin-action-btn' onClick={() => handleAction(onReviews)}>
                        Reviews
                    </button>
                    <button
                        className='admin-action-btn admin-action-danger'
                        onClick={() => {
                            onSignOut();
                            onClose();
                        }}
                    >
                        Sign out
                    </button>
                </div>
            </div>
        </div>
    );
}

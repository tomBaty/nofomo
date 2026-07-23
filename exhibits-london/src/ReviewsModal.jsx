import { useEffect, useState } from 'react';

export function ReviewsModal({ mode = 'user', userProfile, exhibit, allReviews, exhibits, onClose }) {
    const isExhibitMode = mode === 'exhibit';
    const [userReviews, setUserReviews] = useState([]);
    const [loading, setLoading] = useState(!isExhibitMode);
    const [error, setError] = useState(null);

    const reviews = isExhibitMode
        ? allReviews?.filter(review => review.exhibitId === exhibit?.id) ?? []
        : userReviews;

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

    useEffect(() => {
        if (isExhibitMode || !userProfile?.sessionId) {
            return;
        }

        let cancelled = false;
        fetch('/api/reviews', {
            headers: {
                'Authorization': `Bearer ${userProfile.sessionId}`,
                'X-Session-Id': userProfile.sessionId
            }
        })
            .then(res => {
                if (!res.ok) throw new Error('Failed to load reviews');
                return res.json();
            })
            .then(data => {
                if (!cancelled) {
                    setUserReviews(data);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (!cancelled) {
                    setError(err.message);
                    setLoading(false);
                }
            });
        return () => { cancelled = true; };
    }, [isExhibitMode, userProfile?.sessionId]);

    const title = isExhibitMode
        ? `Reviews for ${exhibit?.title ?? 'this exhibit'}`
        : 'Your Reviews';

    const emptyMessage = isExhibitMode
        ? 'No reviews yet for this exhibit.'
        : "You haven't left any reviews yet.";

    return (
        <div className='admin-modal-overlay' onClick={onClose}>
            <div className='admin-modal-content' onClick={(e) => e.stopPropagation()}>
                <button className='admin-modal-close-btn' onClick={onClose}>×</button>
                <h2>{title}</h2>
                {loading && <p>Loading...</p>}
                {error && <p className='profile-modal-error'>Error: {error}</p>}
                {!loading && !error && reviews.length === 0 && (
                    <p>{emptyMessage}</p>
                )}
                {!loading && !error && reviews.length > 0 && (
                    <ul className='profile-reviews-list'>
                        {reviews.map(review => (
                            <li key={review.reviewId} className='profile-review-item'>
                                {!isExhibitMode && (
                                    <div className='profile-review-exhibit'>
                                        {exhibits?.find(ex => ex.id === review.exhibitId)?.title || '-'}
                                    </div>
                                )}
                                <div className='profile-review-stars'>
                                    {'★'.repeat(review.stars)}{'☆'.repeat(5 - review.stars)}
                                </div>
                                {review.time && <p className='profile-review-time'>Time spent: {review.time}</p>}
                                {review.comment && <p className='profile-review-comment'>{review.comment}</p>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

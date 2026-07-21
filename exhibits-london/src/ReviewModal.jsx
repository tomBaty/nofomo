import { useEffect, useState } from 'react';

const TIME_OPTIONS = [
    { value: '<15m', label: '<15m' },
    { value: '15-1h', label: '15-1h' },
    { value: '1hr+', label: '1hr+' }
];

export function ReviewModal({ exhibit, userProfile, onClose, onSubmitted }) {
    const [time, setTime] = useState('');
    const [stars, setStars] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const canSubmit = stars > 0 && !isSubmitting;

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

    const handleSubmit = async () => {
        if (!canSubmit) return;

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userProfile.sessionId}`
                },
                body: JSON.stringify({
                    exhibitId: exhibit.id,
                    time: time || undefined,
                    stars,
                    comment: comment.trim() || undefined
                })
            });

            if (!res.ok) throw new Error('Failed to submit review');

            onSubmitted?.();
            onClose();
        } catch (err) {
            console.error('Error submitting review:', err);
            alert('Failed to submit review. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className='review-modal-overlay' onClick={onClose}>
            <div className='review-modal-content' onClick={(e) => e.stopPropagation()}>
                <button className='review-modal-close-btn' onClick={onClose}>×</button>
                <h2>Leave a Review</h2>

                <div className='review-field'>
                    <label>Time spent <span className='review-optional'>(optional)</span></label>
                    <div className='review-radio-group'>
                        {TIME_OPTIONS.map(opt => (
                            <label
                                key={opt.value}
                                className={`review-radio-option${time === opt.value ? ' selected' : ''}`}
                            >
                                <input
                                    type='radio'
                                    name='review-time'
                                    value={opt.value}
                                    checked={time === opt.value}
                                    onChange={() => setTime(opt.value)}
                                />
                                {opt.label}
                            </label>
                        ))}
                    </div>
                </div>

                <div className='review-field'>
                    <label>Rating <span className='review-required'>*</span></label>
                    <div className='review-stars'>
                        {[1, 2, 3, 4, 5].map(s => (
                            <button
                                key={s}
                                type='button'
                                className={`review-star${s <= (hoveredStar || stars) ? ' filled' : ''}`}
                                onMouseEnter={() => setHoveredStar(s)}
                                onMouseLeave={() => setHoveredStar(0)}
                                onClick={() => setStars(s)}
                                aria-label={`${s} star${s === 1 ? '' : 's'}`}
                            >
                                ★
                            </button>
                        ))}
                    </div>
                </div>

                <div className='review-field'>
                    <label>
                        Additional comments <span className='review-optional'>(optional)</span>
                        <span className='review-char-count'>{comment.length}/1000</span>
                    </label>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value.slice(0, 1000))}
                        rows={5}
                        placeholder='Share your thoughts...'
                        maxLength={1000}
                    />
                </div>

                <button
                    className='review-submit-btn'
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                >
                    {isSubmitting ? 'Submitting...' : 'Finish Review'}
                </button>
            </div>
        </div>
    );
}

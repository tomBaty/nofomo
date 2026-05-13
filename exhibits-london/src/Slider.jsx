import { useState, useRef, useEffect } from 'react'

export function Slider({ min, max, value, onChange, label, formatValue = (v) => v, step = 1 }) {
    const [isOpen, setIsOpen] = useState(false)
    const [localValue, setLocalValue] = useState(value)
    const [dragging, setDragging] = useState(null) // 'min' or 'max'
    const trackRef = useRef(null)

    // Sync localValue with prop value changes
    useEffect(() => {
        setLocalValue(value)
    }, [value])

    const handleMouseDown = (handle) => (e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragging(handle)
    }

    // Add/remove global mouse event listeners
    useEffect(() => {
        if (!dragging) return

        const handleMouseMove = (e) => {
            if (!trackRef.current) return

            const rect = trackRef.current.getBoundingClientRect()
            const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
            const rawValue = min + percentage * (max - min)
            const steppedValue = Math.round(rawValue / step) * step

            setLocalValue(prev => {
                let newValue = [...prev]
                if (dragging === 'min') {
                    newValue[0] = Math.min(steppedValue, prev[1])
                } else if (dragging === 'max') {
                    newValue[1] = Math.max(steppedValue, prev[0])
                }
                onChange(newValue)
                return newValue
            })
        }

        const handleMouseUp = () => {
            setDragging(null)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [dragging, min, max, step, onChange])

    // Set body cursor during drag
    useEffect(() => {
        if (dragging) {
            document.body.style.cursor = 'grabbing'
            document.body.style.userSelect = 'none'
            return () => {
                document.body.style.cursor = ''
                document.body.style.userSelect = ''
            }
        }
    }, [dragging])

    // Calculate positions for handles
    const minPosition = ((localValue[0] - min) / (max - min)) * 100
    const maxPosition = ((localValue[1] - min) / (max - min)) * 100

    // Check if the filter is active (not showing all values)
    const isActive = localValue[0] !== min || localValue[1] !== max

    return (
        <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => {
                // Don't close while dragging
                if (!dragging) {
                    setIsOpen(false)
                }
            }}
        >
            <button
                style={{
                    padding: '10px 60px',
                    fontSize: '16px',
                    cursor: 'pointer',
                    backgroundColor: isActive ? '#e0e0e0' : '#f0f0f0',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                }}
            >
                {label}
            </button>

            {isOpen && (
                <div style={{
                    paddingTop: '15px',
                    padding: '15px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '4px',
                    position: 'absolute',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px',
                    minWidth: '300px',
                    top: '100%',
                    left: '0',
                    zIndex: '1000',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
                        <span>{formatValue(localValue[0])}</span>
                        <span>{formatValue(localValue[1])}</span>
                    </div>

                    {/* Single track with two handles */}
                    <div style={{ padding: '20px 0', position: 'relative' }}>
                        {/* Track */}
                        <div
                            ref={trackRef}
                            style={{
                                position: 'relative',
                                height: '6px',
                                backgroundColor: '#ddd',
                                borderRadius: '3px',
                                cursor: 'pointer'
                            }}
                            onClick={(e) => {
                                const rect = trackRef.current.getBoundingClientRect()
                                const percentage = (e.clientX - rect.left) / rect.width
                                const rawValue = min + percentage * (max - min)
                                const steppedValue = Math.round(rawValue / step) * step

                                // Click closer to min or max handle
                                const distToMin = Math.abs(steppedValue - localValue[0])
                                const distToMax = Math.abs(steppedValue - localValue[1])

                                let newValue = [...localValue]
                                if (distToMin < distToMax) {
                                    newValue[0] = Math.min(steppedValue, localValue[1])
                                } else {
                                    newValue[1] = Math.max(steppedValue, localValue[0])
                                }

                                setLocalValue(newValue)
                                onChange(newValue)
                            }}
                        >
                            {/* Active range highlight */}
                            <div
                                style={{
                                    position: 'absolute',
                                    left: `${minPosition}%`,
                                    right: `${100 - maxPosition}%`,
                                    height: '100%',
                                    backgroundColor: '#4CAF50',
                                    borderRadius: '3px'
                                }}
                            />

                            {/* Min handle */}
                            <div
                                onMouseDown={handleMouseDown('min')}
                                style={{
                                    position: 'absolute',
                                    left: `${minPosition}%`,
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '20px',
                                    height: '20px',
                                    backgroundColor: dragging === 'min' ? '#45a049' : '#4CAF50',
                                    borderRadius: '50%',
                                    cursor: dragging === 'min' ? 'grabbing' : 'grab',
                                    border: '2px solid white',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                    zIndex: dragging === 'min' ? 2 : 1,
                                    userSelect: 'none'
                                }}
                            />

                            {/* Max handle */}
                            <div
                                onMouseDown={handleMouseDown('max')}
                                style={{
                                    position: 'absolute',
                                    left: `${maxPosition}%`,
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '20px',
                                    height: '20px',
                                    backgroundColor: dragging === 'max' ? '#45a049' : '#4CAF50',
                                    borderRadius: '50%',
                                    cursor: dragging === 'max' ? 'grabbing' : 'grab',
                                    border: '2px solid white',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                    zIndex: dragging === 'max' ? 2 : 1,
                                    userSelect: 'none'
                                }}
                            />
                        </div>
                    </div>

                    {/* Reset button */}
                    {isActive && (
                        <button
                            onClick={() => {
                                const resetValue = [min, max]
                                setLocalValue(resetValue)
                                onChange(resetValue)
                            }}
                            style={{
                                padding: '8px 16px',
                                fontSize: '14px',
                                cursor: 'pointer',
                                backgroundColor: '#fff',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                alignSelf: 'center'
                            }}
                        >
                            Reset
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

import { useState } from 'react'

export function Filter({ items, selectedItems, onToggle, label, itemLabel }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div 
      style={{ position: 'relative' }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button 
        style={{
          padding: '10px 60px',
          fontSize: '16px',
          cursor: 'pointer',
          backgroundColor: '#f0f0f0',
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
          maxHeight: '300px',
          overflowY: 'auto',
          position: 'absolute',
          display: 'flex',
          flexDirection: 'row',
          gap: '10px',
          maxWidth: '1050px',
          flexWrap: 'wrap',
          top: '100%',
          left: '0',
          zIndex: '1000'
        }}>
          {items.map((item) => (
            <label 
              key={item}
              className='filter-option'
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: selectedItems.includes(item) ? '#e0e0e0' : 'transparent',
                opacity: selectedItems.includes(item) ? 1 : 0.5,
                cursor: 'pointer',
                padding: '8px 20px',
                borderRadius: '50px',
                transition: 'all 0.2s'
              }}
              onClick={() => onToggle(item)}
            >
              <span>
                {item}
              </span>
            </label>
          ))}
        </div>
      )}
      
      {/* <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
        Showing {selectedItems.length} of {items.length} {itemLabel}
      </div> */}
    </div>
  )
}

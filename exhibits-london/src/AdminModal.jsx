import { useEffect, useRef, useState } from 'react';
import { IMAGE_BASE_URL } from './constants';

const RAW_FIELDS = [
    { key: 'title', label: 'Title', multiline: false },
    { key: 'venue', label: 'Venue', multiline: false },
    { key: 'paid', label: 'Paid', multiline: false },
    { key: 'category', label: 'Category', multiline: false },
    { key: 'icon', label: 'Icon', multiline: false },
    { key: 'dateRangeType', label: 'Date Range Type', multiline: false },
    { key: 'url', label: 'URL', multiline: false },
    { key: 'imageUrl', label: 'Image URL', multiline: false },
    { key: 'shortDescription', label: 'Short Description', multiline: true },
    { key: 'priceInfo', label: 'Price Info', multiline: true },
    { key: 'description', label: 'Description', multiline: true },
    { key: 'descriptionHTML', label: 'Description HTML', multiline: true },
    { key: 'dates', label: 'Dates (one per line)', multiline: true }
];

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function resizeImageToPng(dataUrl, width, height) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            const scale = Math.max(width / img.width, height / img.height);
            const drawWidth = img.width * scale;
            const drawHeight = img.height * scale;
            const x = (width - drawWidth) / 2;
            const y = (height - drawHeight) / 2;

            ctx.drawImage(img, x, y, drawWidth, drawHeight);
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

export function AdminModal({ exhibit, userProfile, onClose, onDeleted, onUpdated }) {
    const [activeView, setActiveView] = useState('menu');
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [editedExhibit, setEditedExhibit] = useState(() => ({
        ...exhibit,
        dates: Array.isArray(exhibit.dates) ? exhibit.dates.join('\n') : ''
    }));
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);

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



    const sessionHeaders = () => ({
        'X-Session-Id': userProfile.sessionId
    });

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/exhibitions/${exhibit.id}`, {
                method: 'DELETE',
                headers: sessionHeaders()
            });
            if (!res.ok) throw new Error('Failed to delete exhibit');
            onDeleted?.();
            onClose();
        } catch (err) {
            console.error('Error deleting exhibit:', err);
            alert('Failed to delete exhibit.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSelectedFile(file);
        try {
            const dataUrl = await readFileAsDataUrl(file);
            setPreviewUrl(dataUrl);
        } catch {
            setPreviewUrl(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        setIsUploading(true);
        try {
            const fileDataUrl = await readFileAsDataUrl(selectedFile);
            const pngBlob = await resizeImageToPng(fileDataUrl, 120, 160);
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(pngBlob);
            });
            const base64 = dataUrl.split(',')[1];

            const res = await fetch(`/api/exhibitions/${exhibit.id}/image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...sessionHeaders()
                },
                body: JSON.stringify({ image: base64 })
            });

            if (!res.ok) throw new Error('Failed to upload image');

            const data = await res.json();
            const iconUrl = IMAGE_BASE_URL + data.imageUrl;

            const patchRes = await fetch(`/api/exhibitions/${exhibit.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...sessionHeaders()
                },
                body: JSON.stringify({ icon: data.imageUrl })
            });

            if (!patchRes.ok) throw new Error('Failed to update exhibit icon');

            onUpdated?.(exhibit.id, { imageUrl: data.imageUrl, icon: iconUrl });
            setSelectedFile(null);
            setPreviewUrl(null);
            setActiveView('menu');
        } catch (err) {
            console.error('Error uploading image:', err);
            alert('Failed to upload image or update icon.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveRaw = async () => {
        setIsSaving(true);
        try {
            const updates = {
                ...editedExhibit,
                dates: editedExhibit.dates.split('\n').map(d => d.trim()).filter(Boolean)
            };
            delete updates.id;

            const res = await fetch(`/api/exhibitions/${exhibit.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...sessionHeaders()
                },
                body: JSON.stringify(updates)
            });

            if (!res.ok) throw new Error('Failed to update exhibit');

            onUpdated?.(exhibit.id, updates);
            setActiveView('menu');
        } catch (err) {
            console.error('Error updating exhibit:', err);
            alert('Failed to save exhibit data.');
        } finally {
            setIsSaving(false);
        }
    };

    const renderMenu = () => (
        <>
            <h2>Admin Actions</h2>
            <div className='admin-action-list'>
                <button
                    className='admin-action-btn admin-action-danger'
                    onClick={() => setDeleteConfirm(true)}
                >
                    Delete Exhibit
                </button>
                <button
                    className='admin-action-btn'
                    onClick={() => setActiveView('upload')}
                >
                    Upload Photo
                </button>
                <button
                    className='admin-action-btn'
                    onClick={() => setActiveView('edit')}
                >
                    Edit Raw Exhibit Data
                </button>
            </div>
            {deleteConfirm && (
                <div className='admin-confirm-box'>
                    <p>Are you sure you want to delete <strong>{exhibit.title}</strong>?</p>
                    <div className='admin-confirm-actions'>
                        <button
                            className='admin-confirm-yes'
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Yes, delete'}
                        </button>
                        <button
                            className='admin-confirm-no'
                            onClick={() => setDeleteConfirm(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </>
    );

    const renderUpload = () => (
        <>
            <h2>Upload Photo</h2>
            <input
                ref={fileInputRef}
                type='file'
                accept='image/*'
                onChange={handleFileSelect}
                className='admin-file-input'
            />
            <button
                className='admin-action-btn'
                onClick={() => fileInputRef.current?.click()}
            >
                {selectedFile ? 'Choose a different photo' : 'Choose from camera roll'}
            </button>
            {previewUrl && (
                <div className='admin-upload-preview'>
                    <img src={previewUrl} alt='Preview' />
                    <p>Will be resized to 200 x 300 px</p>
                </div>
            )}
            <div className='admin-action-actions'>
                <button
                    className='admin-submit-btn'
                    onClick={handleUpload}
                    disabled={!selectedFile || isUploading}
                >
                    {isUploading ? 'Uploading...' : 'Upload Photo'}
                </button>
                <button
                    className='admin-secondary-btn'
                    onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setActiveView('menu');
                    }}
                    disabled={isUploading}
                >
                    Back
                </button>
            </div>
        </>
    );

    const renderEdit = () => (
        <>
            <h2>Edit Raw Exhibit Data</h2>
            <div className='admin-edit-form'>
                {RAW_FIELDS.map(field => (
                    <div className='admin-edit-field' key={field.key}>
                        <label>{field.label}</label>
                        {field.multiline ? (
                            <textarea
                                value={editedExhibit[field.key] ?? ''}
                                onChange={(e) => setEditedExhibit(prev => ({ ...prev, [field.key]: e.target.value }))}
                                rows={field.key === 'dates' ? 4 : 3}
                            />
                        ) : (
                            <input
                                type='text'
                                value={editedExhibit[field.key] ?? ''}
                                onChange={(e) => setEditedExhibit(prev => ({ ...prev, [field.key]: e.target.value }))}
                            />
                        )}
                    </div>
                ))}
            </div>
            <div className='admin-action-actions'>
                <button
                    className='admin-submit-btn'
                    onClick={handleSaveRaw}
                    disabled={isSaving}
                >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                    className='admin-secondary-btn'
                    onClick={() => setActiveView('menu')}
                    disabled={isSaving}
                >
                    Back
                </button>
            </div>
        </>
    );

    return (
        <div className='admin-modal-overlay' onClick={onClose}>
            <div className='admin-modal-content' onClick={(e) => e.stopPropagation()}>
                <button className='admin-modal-close-btn' onClick={onClose}>×</button>
                {activeView === 'menu' && renderMenu()}
                {activeView === 'upload' && renderUpload()}
                {activeView === 'edit' && renderEdit()}
            </div>
        </div>
    );
}

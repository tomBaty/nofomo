import './SkeletonLoader.css';
// import { SearchBar } from "./SearchBar";
import { NavBar } from "./NavBar";
import { IMAGE_BASE_URL } from './constants';

export function SkeletonLoader() {
    return (
        <div>
            <img src={IMAGE_BASE_URL + 'headerlogo.png'} id='logo' />
            <NavBar />

            {/* Skeleton Exhibit Cards */}
            <div className="skeleton-exhibits">
                {[...Array(8)].map((_, index) => (
                    <div key={index} className="skeleton-exhibit-card">
                        <div className="skeleton skeleton-exhibit-image"></div>
                        <div className="skeleton-exhibit-content">
                            <div className="skeleton skeleton-title"></div>
                            <div className="skeleton skeleton-text"></div>
                            <div className="skeleton skeleton-text"></div>
                            <div className="skeleton skeleton-text-short"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

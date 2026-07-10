import { useMemo, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import "./VenueMap.css";
import { IMAGE_BASE_URL } from './constants';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export function VenueMap({ venues = [] }) {
    const [selectedVenue, setSelectedVenue] = useState(null);
    console.log("Mapbox token present:", MAPBOX_TOKEN);

    const validVenues = useMemo(() => {
        return venues.filter(
            (venue) =>
                Array.isArray(venue.coordinates) &&
                typeof venue.coordinates[0] === "number" &&
                typeof venue.coordinates[1] === "number"
        );
    }, [venues]);

    const getImageForCategory = (category) => {
        switch (category) {
            case "Museum":
                return IMAGE_BASE_URL + 'museum_map_icon.png';
            case "Gallery":
                return IMAGE_BASE_URL + 'gallery_map_icon.png';
            case "Theatre":
                return IMAGE_BASE_URL + 'theatre_map_icon.png';
            default:
                return IMAGE_BASE_URL + 'museum_map_icon.png';
        }
    }

    return (
        <div className="exhibition-map">
            <Map
                mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={{
                    longitude: -0.1278,
                    latitude: 51.5074,
                    zoom: 11
                }}
                mapStyle="mapbox://styles/tbaty/cmqvgfnwd003z01s6e9io7os0"
                style={{ width: "100%", height: "100%" }}
            >
                <NavigationControl position="top-right" />

                {validVenues.map((venue) => (
                    <Marker
                        key={venue.name}
                        longitude={venue.coordinates[1]}
                        latitude={venue.coordinates[0]}
                        anchor="bottom"
                        onClick={(event) => {
                            event.originalEvent.stopPropagation();
                            setSelectedVenue(venue);
                        }}
                    >
                        <button
                            className="map-marker"
                            aria-label={`View ${venue.name}`}
                        >
                            <img src={getImageForCategory(venue.category)} alt={venue.name} style={{width: '20px', height: '20px'}} />
                        </button>
                    </Marker>
                ))}

                {selectedVenue && (
                    <Popup
                        longitude={selectedVenue.coordinates[1]}
                        latitude={selectedVenue.coordinates[0]}
                        anchor="top"
                        closeOnClick={false}
                        onClose={() => setSelectedVenue(null)}
                    >
                        <div className="map-popup">
                            <strong>{selectedVenue.name}</strong>
                            <small>{selectedVenue.category}</small>
                        </div>
                    </Popup>
                )}
            </Map>
        </div>
    );
}
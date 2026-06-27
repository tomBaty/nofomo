import { useMemo, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import "./VenueMap.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export function VenueMap({ venues = [] }) {
  const [selectedVenue, setSelectedVenue] = useState(null);

  const validVenues = useMemo(() => {
    return venues.filter(
      (venue) =>
        Array.isArray(venue.coordinates) &&
        typeof venue.coordinates[0] === "number" &&
        typeof venue.coordinates[1] === "number"
    );
  }, [venues]);

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
            key={venue.id}
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
              <span className="map-marker-dot" />
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
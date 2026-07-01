import './App.css'
import { VenueMap } from './VenueMap'
import venues from './venue_information.json'

// This page is built and served independently of the main SPA (see /about/index.html
// and the "about" entry in vite.config.js), but reuses shared components like VenueMap.
export function AboutPage() {
    return (
        <div className="App">
            <header style={{ padding: '32px 20px', textAlign: 'center' }}>
                <h1>About NOFOMO London</h1>
                <p>NOFOMO London helps you discover exhibitions across the city's museums and galleries.</p>
            </header>
            <VenueMap venues={venues} />
        </div>
    )
}

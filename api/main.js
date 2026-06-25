const { BlobServiceClient } = require("@azure/storage-blob");
const { app } = require("@azure/functions");

// Cache for exhibitions data
let exhibitionsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const _blob_service = (acct) => {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    
    if (connectionString) {
        // Use connection string if available
        return BlobServiceClient.fromConnectionString(connectionString);
    } else {
        // Use anonymous access for public blobs
        return new BlobServiceClient(
            `https://${acct}.blob.core.windows.net`
        );
    }
};

async function _blob_read_json(blob_name) {
    const container = "exhibits-data";
    const buffer = await _blob_service('nofomodata')
        .getContainerClient(container)
        .getBlobClient(blob_name)
        .downloadToBuffer()

    return JSON.parse(buffer.toString());
}

async function fetchExhibitionsData(context) {
    // Check cache first
    const now = Date.now();
    if (exhibitionsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION_MS) {
        context.log('Using cached exhibitions data');
        return exhibitionsCache;
    }

    try {
        context.log('Fetching exhibitions from blob storage');
        const data = await _blob_read_json('all_exhibitions.json');
        
        // Update cache
        exhibitionsCache = data;
        cacheTimestamp = now;
        
        return data;
    } catch (error) {
        context.log.error('Error fetching from blob storage:', error);
        
        // If we have stale cache, use it as fallback
        if (exhibitionsCache) {
            context.log('Using stale cache as fallback');
            return exhibitionsCache;
        }
        
        throw error;
    }
}

app.http('exhibitions', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'exhibitions',
    handler: async (request, context) => {
        context.log('Exhibitions API function processed a request.');

        try {
            // Fetch exhibitions data from blob storage
            const exhibitions = await fetchExhibitionsData(context);
            let filteredExhibitions = [...exhibitions];

            // Filter by start date (exhibitions ending on or after this date)
            const startDate = request.query.get('startDate');
            if (startDate) {
                const startDateObj = new Date(startDate);
                filteredExhibitions = filteredExhibitions.filter(ex => {
                    const endDate = new Date(ex.dates[ex.dates.length - 1]);
                    return endDate >= startDateObj;
                });
            }

            // Filter by end date (exhibitions starting on or before this date)
            const endDate = request.query.get('endDate');
            if (endDate) {
                const endDateObj = new Date(endDate);
                filteredExhibitions = filteredExhibitions.filter(ex => {
                    const startDate = new Date(ex.dates[0]);
                    return startDate <= endDateObj;
                });
            }

            // Filter by venue
            const venue = request.query.get('venue');
            if (venue) {
                const venues = Array.isArray(venue) ? venue : [venue];
                filteredExhibitions = filteredExhibitions.filter(ex => 
                    venues.includes(ex.venue)
                );
            }

            // Filter by paid/free
            const paid = request.query.get('paid');
            if (paid) {
                filteredExhibitions = filteredExhibitions.filter(ex => 
                    ex.paid === paid
                );
            }

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                jsonBody: filteredExhibitions
            };
        } catch (error) {
            context.log.error('Error processing request:', error);
            return {
                status: 500,
                jsonBody: { error: 'Internal server error' }
            };
        }
    }
})

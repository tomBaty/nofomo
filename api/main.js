const { BlobServiceClient } = require("@azure/storage-blob");
const { app } = require("@azure/functions");
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client();

async function verifyGoogleUser(token) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: '797883913821-9qtpse6mbboe6rh4b62rjhlj47mjddqb.apps.googleusercontent.com'
    });

    const payload = ticket.getPayload();
    // This ID is unique to each Google Account, making it suitable for use as a primary key
    // during account lookup. Email is not a good choice because it can be changed by the user.
    const userid = payload['sub'];
    return { userid, payload };
}

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
        console.warn('AZURE_STORAGE_CONNECTION_STRING not set, using anonymous access for public blobs');
        // Use anonymous access for public blobs
        return new BlobServiceClient(
            `https://${acct}.blob.core.windows.net`
        );
    }
};

async function _blob_read_json(container, blob_name) {
    const buffer = await _blob_service('nofomodata')
        .getContainerClient(container)
        .getBlobClient(blob_name)
        .downloadToBuffer()

    return JSON.parse(buffer.toString());
}

async function _blob_write_json(container, blob_name, data) {
    const content = JSON.stringify(data);
    const blockBlobClient = _blob_service('nofomodata')
        .getContainerClient(container)
        .getBlockBlobClient(blob_name);

    await blockBlobClient.upload(content, Buffer.byteLength(content), {
        blobHTTPHeaders: { blobContentType: 'application/json' }
    });
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
        const data = await _blob_read_json("exhibits-data", 'all_exhibitions.json');

        // Update cache
        exhibitionsCache = data;
        cacheTimestamp = now;

        return data;
    } catch (error) {
        context.error('Error fetching from blob storage:', error);

        // If we have stale cache, use it as fallback
        if (exhibitionsCache) {
            context.log('Using stale cache as fallback');
            return exhibitionsCache;
        }

        throw error;
    }
}

async function fetchUserFromBlob(context, userId) {
    try {
        context.log('Fetching user from blob storage');
        const data = await _blob_read_json("users", userId + `.json`);

        return data;
    } catch (error) {
        context.error('Error fetching from blob storage:', error);

        // // If we have stale cache, use it as fallback
        // if (exhibitionsCache) {
        //     context.log('Using stale cache as fallback');
        //     return exhibitionsCache;
        // }

        throw error;
    }
}

const SUPPORTED_USER_UPDATE_ACTIONS = ['updateFavourites', 'updateVisited'];

async function updateUserInBlob(context, userId, action, { favourites, visited }) {
    // Load any existing record for this user, defaulting to an empty one if
    // this is the user's first update (i.e. their file doesn't exist yet)
    let userData;
    try {
        userData = await fetchUserFromBlob(context, userId);
    } catch (error) {
        context.log('No existing record for user ' + userId + ', creating a new one');
        userData = {};
    }

    if (action === 'updateFavourites') {
        userData.favourites = favourites;
    } else if (action === 'updateVisited') {
        userData.visited = visited;
    }

    await _blob_write_json('users', userId + '.json', userData);
    return userData;
}

app.http('user', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'user',
    handler: async (request, context) => {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                status: 401,
                jsonBody: { error: 'Missing or invalid Authorization header' }
            };
        }
        const idToken = authHeader.slice('Bearer '.length);

        // Verify the Google ID token server-side before trusting any of its contents
        let userid, payload;
        try {
            ({ userid, payload } = await verifyGoogleUser(idToken));
        } catch (error) {
            context.error('Error verifying Google token:', error);
            return {
                status: 401,
                jsonBody: { error: 'Invalid Google token' }
            };
        }

        context.log('Fetching user ' + userid);

        // Look up any previously stored data for this user, but don't fail
        // the request if none exists yet
        let userData = null;
        try {
            userData = await fetchUserFromBlob(context, userid);
        } catch (error) {
            context.log('No stored data found for user ' + userid);
        }

        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            jsonBody: { userid, profile: payload, userData }
        };
    }
})

app.http('updateUser', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'user',
    handler: async (request, context) => {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                status: 401,
                jsonBody: { error: 'Missing or invalid Authorization header' }
            };
        }
        const idToken = authHeader.slice('Bearer '.length);

        // Verify the Google ID token server-side before trusting who is making the update
        let userid;
        try {
            ({ userid } = await verifyGoogleUser(idToken));
        } catch (error) {
            context.error('Error verifying Google token:', error);
            return {
                status: 401,
                jsonBody: { error: 'Invalid Google token' }
            };
        }

        let body;
        try {
            body = await request.json();
        } catch (error) {
            return {
                status: 400,
                jsonBody: { error: 'Invalid or missing JSON body' }
            };
        }

        const { action, favourites, visited } = body || {};

        if (!SUPPORTED_USER_UPDATE_ACTIONS.includes(action)) {
            return {
                status: 400,
                jsonBody: { error: `action must be one of: ${SUPPORTED_USER_UPDATE_ACTIONS.join(', ')}` }
            };
        }

        if (action === 'updateFavourites' && !Array.isArray(favourites)) {
            return {
                status: 400,
                jsonBody: { error: 'favourites must be an array' }
            };
        }

        if (action === 'updateVisited' && !Array.isArray(visited)) {
            return {
                status: 400,
                jsonBody: { error: 'visited must be an array' }
            };
        }

        try {
            const userData = await updateUserInBlob(context, userid, action, { favourites, visited });
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                jsonBody: { userid, userData }
            };
        } catch (error) {
            context.error('Error updating user data:', error);
            return {
                status: 500,
                jsonBody: { error: 'Internal server error' }
            };
        }
    }
})

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
            context.error('Error processing request:', error);
            return {
                status: 500,
                jsonBody: { error: 'Internal server error' }
            };
        }
    }
})

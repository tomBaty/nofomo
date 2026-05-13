const exhibitions = require('./data/all_exhibitions.json');
const { app } = require("@azure/functions");

app.http('exhibitions', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'exhibitions',
    handler: async (request, context) => {
        context.log('Exhibitions API function processed a request.');

        try {
            let filteredExhibitions = [...exhibitions];

            // Filter by start date (exhibitions ending on or after this date)
            const startDate = request.query.get('startDate');
            if (startDate) {
                const startDateObj = new Date(startDate);
                filteredExhibitions = filteredExhibitions.filter(ex => {
                    const endDate = new Date(ex.endDate);
                    return endDate >= startDateObj;
                });
            }

            // Filter by end date (exhibitions starting on or before this date)
            const endDate = request.query.get('endDate');
            if (endDate) {
                const endDateObj = new Date(endDate);
                filteredExhibitions = filteredExhibitions.filter(ex => {
                    const startDate = new Date(ex.startDate);
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

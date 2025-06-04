// netlify/functions/orcid-config.js
// Provides ORCID configuration to frontend (without exposing secret)

exports.handler = async (event, context) => {
    // Handle CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Return public ORCID configuration (NO SECRET!)
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                clientId: process.env.ORCID_CLIENT_ID,
                baseUrl: process.env.ORCID_BASE_URL || 'https://sandbox.orcid.org',
                scope: '/authenticate',
                redirectUri: 'https://research-graph.netlify.app/auth/orcid/callback' // Update this!
            })
        };
    } catch (error) {
        console.error('❌ Error in ORCID config:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Configuration error' })
        };
    }
};

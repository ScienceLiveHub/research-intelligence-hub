// netlify/functions/load-profile.js
// Load user profile data from Netlify Blobs

const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
    // Handle CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
        // Get ORCID ID from query parameters
        const orcidId = event.queryStringParameters?.orcid;

        console.log('📖 Loading profile for ORCID:', orcidId);

        // Validate ORCID ID
        if (!orcidId || !orcidId.match(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Valid ORCID ID is required',
                    code: 'INVALID_ORCID'
                })
            };
        }

        // Get Netlify Blobs store
        const store = getStore('user-profiles');

        // Try to load profile data
        const profileData = await store.get(orcidId);

        if (!profileData) {
            // Profile not found - this is normal for new users
            console.log('📭 No profile found for:', orcidId);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    found: false,
                    message: 'No profile found for this ORCID ID',
                    orcidId: orcidId
                })
            };
        }

        // Parse the stored profile data
        const profile = JSON.parse(profileData);

        console.log('✅ Profile loaded successfully for:', orcidId);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                found: true,
                orcidId: orcidId,
                profile: profile,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('❌ Error loading profile:', error);

        // Handle JSON parsing errors
        if (error.name === 'SyntaxError') {
            console.error('🔴 Corrupted profile data for ORCID:', event.queryStringParameters?.orcid);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'Corrupted profile data',
                    code: 'CORRUPTED_DATA',
                    message: 'Profile data is corrupted and cannot be read'
                })
            };
        }

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to load profile',
                code: 'LOAD_ERROR',
                message: error.message
            })
        };
    }
};

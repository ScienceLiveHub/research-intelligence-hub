// netlify/functions/save-profile.js
// Save user profile data to Netlify Blobs

const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
    // Handle CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Parse request body
        const requestData = JSON.parse(event.body);
        const { orcidId, profileData, userInfo } = requestData;

        console.log('💾 Saving profile for ORCID:', orcidId);

        // Validate input
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

        if (!profileData) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Profile data is required',
                    code: 'MISSING_PROFILE_DATA'
                })
            };
        }

        // Get Netlify Blobs store
        const store = getStore('user-profiles');

        // Prepare profile data to save
        const completeProfile = {
            orcidId: orcidId,
            userInfo: userInfo || {}, // ORCID data (name, email, etc.)
            additionalData: profileData, // User-entered data (research interests, etc.)
            metadata: {
                lastUpdated: new Date().toISOString(),
                version: '1.0.0',
                source: 'research-intelligence-hub'
            }
        };

        // Save to Netlify Blobs with ORCID ID as key
        await store.set(orcidId, JSON.stringify(completeProfile));

        console.log('✅ Profile saved successfully for:', orcidId);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Profile saved successfully',
                orcidId: orcidId,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('❌ Error saving profile:', error);

        // Handle specific errors
        if (error.name === 'SyntaxError') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Invalid JSON in request body',
                    code: 'INVALID_JSON'
                })
            };
        }

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to save profile',
                code: 'SAVE_ERROR',
                message: error.message
            })
        };
    }
};

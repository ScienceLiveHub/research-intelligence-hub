// netlify/functions/orcid-callback.js
// Handles ORCID OAuth callback and token exchange

const https = require('https');
const querystring = require('querystring');

exports.handler = async (event, context) => {
    // Handle CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
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
        // Parse the request body
        const requestData = JSON.parse(event.body);
        const { code, state } = requestData;

        console.log('🔐 Processing ORCID OAuth callback...');

        // Validate input
        if (!code) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Authorization code is required',
                    code: 'MISSING_CODE'
                })
            };
        }

        // Exchange authorization code for access token
        const tokenData = await exchangeCodeForToken(code);
        
        if (!tokenData.access_token) {
            throw new Error('Failed to obtain access token from ORCID');
        }

        console.log('✅ Successfully obtained ORCID access token');

        // Get user profile data from ORCID
        const profileData = await getOrcidProfile(tokenData.orcid, tokenData.access_token);

        // Return successful response with user data
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                user: {
                    orcid: tokenData.orcid,
                    name: profileData.name,
                    email: profileData.email,
                    affiliation: profileData.affiliation,
                    accessToken: tokenData.access_token, // Store securely in production
                    tokenType: tokenData.token_type,
                    scope: tokenData.scope
                },
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('❌ Error in ORCID callback:', error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message || 'OAuth callback error',
                code: error.code || 'CALLBACK_ERROR',
                timestamp: new Date().toISOString()
            })
        };
    }
};

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(code) {
    const baseUrl = process.env.ORCID_BASE_URL || 'https://orcid.org';
    const redirectUri = 'https://research-graph.netlify.app/';
    
    const postData = querystring.stringify({
        client_id: process.env.ORCID_CLIENT_ID,
        client_secret: process.env.ORCID_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
    });

    const options = {
        hostname: baseUrl.replace('https://', ''),
        port: 443,
        path: '/oauth/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const tokenResponse = JSON.parse(data);
                    
                    if (res.statusCode === 200) {
                        resolve(tokenResponse);
                    } else {
                        reject(new Error(`ORCID token exchange failed: ${tokenResponse.error_description || tokenResponse.error}`));
                    }
                } catch (parseError) {
                    reject(new Error(`Failed to parse ORCID token response: ${parseError.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`ORCID token request failed: ${error.message}`));
        });

        req.write(postData);
        req.end();
    });
}

/**
 * Get user profile data from ORCID
 */
async function getOrcidProfile(orcidId, accessToken) {
    const baseUrl = process.env.ORCID_BASE_URL || 'https://orcid.org';
    
    const options = {
        hostname: baseUrl.replace('https://', ''),
        port: 443,
        path: `/v3.0/${orcidId}/person`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    if (res.statusCode === 200) {
                        const profile = JSON.parse(data);
                        
                        // Extract relevant profile information
                        const name = profile.name ? {
                            givenNames: profile.name['given-names']?.value,
                            familyName: profile.name['family-name']?.value,
                            creditName: profile.name['credit-name']?.value
                        } : null;

                        const emails = profile.emails?.email?.map(e => e.email) || [];
                        const affiliations = profile.employments?.['employment-summary']?.map(emp => ({
                            organization: emp.organization?.name,
                            department: emp['department-name'],
                            role: emp['role-title']
                        })) || [];

                        resolve({
                            name: name,
                            email: emails[0] || null, // Primary email
                            affiliation: affiliations[0] || null // Primary affiliation
                        });
                    } else {
                        console.warn(`ORCID profile request returned ${res.statusCode}, using minimal data`);
                        resolve({
                            name: null,
                            email: null,
                            affiliation: null
                        });
                    }
                } catch (parseError) {
                    console.warn(`Failed to parse ORCID profile: ${parseError.message}, using minimal data`);
                    resolve({
                        name: null,
                        email: null,
                        affiliation: null
                    });
                }
            });
        });

        req.on('error', (error) => {
            console.warn(`ORCID profile request failed: ${error.message}, using minimal data`);
            resolve({
                name: null,
                email: null,
                affiliation: null
            });
        });

        req.end();
    });
}

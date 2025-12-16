const express = require('express');
const axios = require('axios');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

const PORT = 3000;

// --- 🔑 TERI CONFIRMED KEY ---
const API_KEY = '15ecf5c2e1msha76c0e9843b9e44p10032bjsn8fc2c9cbe2d8'; 

// --- 🌍 HOSTS ---
const LINKEDIN_HOST = 'jsearch.p.rapidapi.com';
const TWITTER_HOST = 'twitter-api45.p.rapidapi.com'; 

// --- 🛡️ CACHE (24 Hours) ---
let jobCache = { linkedin: null, twitter: null, lastFetchTime: 0 };
const CACHE_DURATION = 1000 * 60 * 60 * 24; 

// 1. LANDING PAGE (Free - No API Cost)
app.get('/', (req, res) => {
    res.render('landing');
});

// 2. MAIN APP (API Calls Here)
app.get('/app', async (req, res) => {
    const source = req.query.source || 'linkedin'; 
    const keyword = req.query.keyword || 'Sustainability'; 
    const location = req.query.location || 'India';
    const workType = req.query.work_type || ''; 
    const forceRefresh = req.query.refresh === 'true';

    // Cache Check
    const isCacheValid = jobCache.lastFetchTime && (Date.now() - jobCache.lastFetchTime < CACHE_DURATION);

    let results = [];
    let error = null;

    try {
        // SCENARIO 1: USE CACHE (Save Quota)
        // Agar user ne koi naya search nahi kiya, aur refresh nahi dabaya
        if (isCacheValid && !forceRefresh && !req.query.keyword) {
            console.log(`Serving ${source} from Cache...`);
            results = source === 'linkedin' ? jobCache.linkedin : jobCache.twitter;
        } 
        // SCENARIO 2: FETCH FRESH DATA
        else {
            if (source === 'linkedin') {
                // --- LINKEDIN (Bulk Load 100 Jobs) ---
                console.log(`Fetching 100+ LinkedIn Jobs...`);
                const options = {
                    method: 'GET',
                    url: `https://${LINKEDIN_HOST}/search`,
                    params: { 
                        query: `${keyword} ${workType} jobs in ${location}`, 
                        num_pages: '10', // <--- YAHAN HAI MAGIC (10 Pages = 100 Jobs)
                        date_posted: 'month' 
                    },
                    headers: { 'X-RapidAPI-Key': API_KEY, 'X-RapidAPI-Host': LINKEDIN_HOST }
                };
                const response = await axios.request(options);
                results = response.data.data || [];
                
                // Cache mein tabhi save karo jab default search ho (taaki agli baar fast khule)
                if (!req.query.keyword || forceRefresh) { 
                    jobCache.linkedin = results; 
                    jobCache.lastFetchTime = Date.now(); 
                }

            } else if (source === 'twitter') {
                // --- TWITTER (Real Data + Demo Multiplier) ---
                console.log(`Fetching Tweets from twitter-api45...`);
                
                const query = `"${keyword}" (hiring OR email OR "send cv") -filter:retweets`;
                
                const options = {
                    method: 'GET',
                    url: `https://${TWITTER_HOST}/search.php`, 
                    params: {
                        query: query,
                        search_type: 'Top' 
                    },
                    headers: { 
                        'X-RapidAPI-Key': API_KEY, 
                        'X-RapidAPI-Host': TWITTER_HOST 
                    }
                };
                
                const response = await axios.request(options);
                let realTweets = response.data.timeline || [];

                // --- MULTIPLIER (20 -> 100 Logic) ---
                if (realTweets.length > 0) {
                    results = [...realTweets];
                    while (results.length < 100) {
                        results = results.concat(realTweets);
                    }
                    results = results.slice(0, 100);
                } else {
                    error = "No tweets found. Try broader keywords.";
                }

                if (!req.query.keyword || forceRefresh) { 
                    jobCache.twitter = results; 
                    jobCache.lastFetchTime = Date.now(); 
                }
            }
        }

    } catch (err) {
        console.error("API Error:", err.message);
        // Fallback: API fail hui toh Cache dikha do
        if (source === 'linkedin' && jobCache.linkedin) results = jobCache.linkedin;
        else if (source === 'twitter' && jobCache.twitter) results = jobCache.twitter;
        else error = "API Limit Reached or Network Error.";
    }

    res.render('index', { 
        results: results, 
        source: source, 
        searchParams: { keyword, location, work_type: workType },
        error: error
    });
});

// Job Details Route
app.get('/job', async (req, res) => {
    const jobId = req.query.id;
    if (!jobId) return res.send("No ID");
    
    // Details ke liye humesha JSearch use karenge
    const options = {
        method: 'GET',
        url: `https://${LINKEDIN_HOST}/job-details`,
        params: { job_id: jobId, extended_publisher_details: 'false' },
        headers: { 'X-RapidAPI-Key': API_KEY, 'X-RapidAPI-Host': LINKEDIN_HOST }
    };
    try {
        const response = await axios.request(options);
        res.render('job-details', { job: response.data.data[0] });
    } catch (e) { res.send("Error fetching details."); }
});

app.listen(PORT, '0.0.0.0', () => { 
    console.log(`Bulk Data Board Live: http://0.0.0.0:${PORT}`);
});
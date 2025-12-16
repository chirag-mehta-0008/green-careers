const express = require('express');
const axios = require('axios');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

const PORT = 3000;

// --- 🔑 TERI API KEY ---
const API_KEY = '15ecf5c2e1msha76c0e9843b9e44p10032bjsn8fc2c9cbe2d8'; 

// --- 🛡️ SMART CACHE SYSTEM ---
let jobCache = {
    linkedin: null,
    twitter: null,
    lastFetchTime: 0
};

// 24 HOURS CACHE (Quota Bachao Mode)
const CACHE_DURATION = 1000 * 60 * 60 * 24; 

app.get('/', async (req, res) => {
    // Inputs
    const source = req.query.source || 'linkedin'; 
    const keyword = req.query.keyword || 'Sustainability'; 
    const location = req.query.location || 'India';
    const workType = req.query.work_type || ''; 
    const forceRefresh = req.query.refresh === 'true'; // <--- NEW BUTTON CHECK

    // Check agar Cache valid hai
    const isCacheValid = jobCache.lastFetchTime && (Date.now() - jobCache.lastFetchTime < CACHE_DURATION);

    let results = [];
    let error = null;

    try {
        // --- SCENARIO 1: USE CACHE (Free) ---
        // Agar Cache valid hai, aur User ne "Refresh Button" NAHI dabaya, aur Default filters hain
        if (isCacheValid && !forceRefresh && !req.query.keyword && !req.query.location && !req.query.work_type) {
            console.log(`Serving ${source} from Cache (No API Cost)...`);
            results = source === 'linkedin' ? jobCache.linkedin : jobCache.twitter;
        } 
        
        // --- SCENARIO 2: FETCH FRESH DATA (Cost 1 Credit) ---
        // Agar Refresh dabaya, ya Cache expire ho gaya, ya naya Search kiya
        else {
            if (source === 'linkedin') {
                console.log(`Fetching FRESH Corporate Jobs (API Call)...`);
                
                const linkedInQuery = `${keyword} ${workType} jobs in ${location}`;
                const options = {
                    method: 'GET',
                    url: 'https://jsearch.p.rapidapi.com/search',
                    params: {
                        query: linkedInQuery, 
                        num_pages: '1', 
                        date_posted: 'month' 
                    },
                    headers: { 'X-RapidAPI-Key': API_KEY, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' }
                };
                const response = await axios.request(options);
                results = response.data.data || [];
                
                // Cache Update karo (Sirf agar default search ho ya Refresh dabaya ho)
                if (!req.query.keyword || forceRefresh) {
                    jobCache.linkedin = results;
                    jobCache.lastFetchTime = Date.now(); // Time reset
                }

            } else if (source === 'twitter') {
                console.log(`Fetching FRESH Tweets (API Call)...`);
                
                const twitterQuery = `"${keyword}" (hiring OR email OR "send cv" OR "dm to apply") -filter:retweets`;
                const options = {
                    method: 'GET',
                    url: 'https://twitter-api45.p.rapidapi.com/search.php',
                    params: {
                        query: twitterQuery,
                        search_type: 'Top' 
                    },
                    headers: { 'X-RapidAPI-Key': API_KEY, 'X-RapidAPI-Host': 'twitter-api45.p.rapidapi.com' }
                };
                
                const response = await axios.request(options);
                let realTweets = response.data.timeline || [];

                // Multiplier Logic (20 -> 100 Demo)
                if (realTweets.length > 0) {
                    results = [...realTweets];
                    while (results.length < 100) {
                        results = results.concat(realTweets);
                    }
                    results = results.slice(0, 100);
                }

                if (!req.query.keyword || forceRefresh) {
                    jobCache.twitter = results;
                    jobCache.lastFetchTime = Date.now(); // Time reset
                }
            }
        }

    } catch (err) {
        console.error("API Error:", err.message);
        // Fallback to Cache
        if (source === 'linkedin' && jobCache.linkedin) results = jobCache.linkedin;
        else if (source === 'twitter' && jobCache.twitter) results = jobCache.twitter;
        else error = "Quota Limit Reached or Network Error.";
    }

    res.render('index', { 
        results: results, 
        source: source, 
        searchParams: { keyword, location, work_type: workType },
        error: error
    });
});

// Job Details
app.get('/job', async (req, res) => {
    const jobId = req.query.id;
    if (!jobId) return res.send("No Job ID");
    const options = {
        method: 'GET',
        url: 'https://jsearch.p.rapidapi.com/job-details',
        params: { job_id: jobId, extended_publisher_details: 'false' },
        headers: { 'X-RapidAPI-Key': API_KEY, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' }
    };
    try {
        const response = await axios.request(options);
        res.render('job-details', { job: response.data.data[0] });
    } catch (error) { res.send("Error details."); }
});

app.listen(PORT, '0.0.0.0', () => { 
    console.log(`Refresh-Enabled Board Live: http://0.0.0.0:${PORT}`);
});
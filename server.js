const express = require('express');
const axios = require('axios');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

const PORT = 3000;

// --- 🔑 TERI NAYI KEY ---
const API_KEY = '15ecf5c2e1msha76c0e9843b9e44p10032bjsn8fc2c9cbe2d8'; 

// --- 🛡️ CACHE SYSTEM (Quota Bachao) ---
// Data yahan store hoga taaki baar-baar API call na lage
let jobCache = {
    linkedin: null,
    twitter: null,
    lastFetchTime: 0
};
// 30 Minute ka Cache (Is dauran koi naya API call nahi hoga)
const CACHE_DURATION = 1000 * 60 * 30; 

app.get('/', async (req, res) => {
    // Inputs
    const source = req.query.source || 'linkedin'; 
    const keyword = req.query.keyword || 'Sustainability'; 
    const location = req.query.location || 'India';
    const workType = req.query.work_type || ''; 

    // Check agar Cache abhi naya hai (Valid hai)
    const isCacheValid = jobCache.lastFetchTime && (Date.now() - jobCache.lastFetchTime < CACHE_DURATION);

    let results = [];
    let error = null;

    try {
        // --- SCENARIO 1: USE CACHE (Free) ---
        // Agar user ne koi filter nahi cheda (Default page hai) aur cache valid hai
        if (isCacheValid && !req.query.keyword && !req.query.location && !req.query.work_type) {
            console.log(`Serving ${source} from Cache (No API Cost)...`);
            results = source === 'linkedin' ? jobCache.linkedin : jobCache.twitter;
        } 
        
        // --- SCENARIO 2: FETCH NEW DATA (Cost 1 Credit) ---
        else {
            if (source === 'linkedin') {
                console.log(`Fetching FRESH Corporate Jobs via API...`);
                
                const linkedInQuery = `${keyword} ${workType} jobs in ${location}`;
                const options = {
                    method: 'GET',
                    url: 'https://jsearch.p.rapidapi.com/search',
                    params: {
                        query: linkedInQuery, 
                        num_pages: '1', // 1 Page = Safe Quota (approx 10-15 jobs)
                        date_posted: 'month' 
                    },
                    headers: {
                        'X-RapidAPI-Key': API_KEY,
                        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
                    }
                };
                const response = await axios.request(options);
                results = response.data.data || [];
                
                // Cache mein save kar lo (Sirf jab default search ho)
                if (!req.query.keyword) {
                    jobCache.linkedin = results;
                    jobCache.lastFetchTime = Date.now();
                }

            } else if (source === 'twitter') {
                console.log(`Fetching FRESH Tweets via API...`);
                
                const twitterQuery = `"${keyword}" (hiring OR email OR "send cv" OR "dm to apply") -filter:retweets`;
                const options = {
                    method: 'GET',
                    url: 'https://twitter-api45.p.rapidapi.com/search.php',
                    params: {
                        query: twitterQuery,
                        search_type: 'Top' 
                    },
                    headers: {
                        'X-RapidAPI-Key': API_KEY,
                        'X-RapidAPI-Host': 'twitter-api45.p.rapidapi.com'
                    }
                };
                
                const response = await axios.request(options);
                let realTweets = response.data.timeline || [];

                // Multiplier Logic (20 Tweets ko 100 bana do demo ke liye)
                if (realTweets.length > 0) {
                    results = [...realTweets];
                    while (results.length < 100) {
                        results = results.concat(realTweets);
                    }
                    results = results.slice(0, 100);
                }

                if (!req.query.keyword) {
                    jobCache.twitter = results;
                }
            }
        }

    } catch (err) {
        console.error("API Error:", err.message);
        // Agar API fail ho jaye, toh purana Cache dikha do (Backup)
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

// Job Details Route
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
    } catch (error) {
        res.send("Error fetching details. Try again later.");
    }
});

// Render ke liye 0.0.0.0 zaroori hai
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Protected Job Board Live: http://0.0.0.0:${PORT}`);
});
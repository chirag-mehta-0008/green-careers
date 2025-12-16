const express = require('express');
const axios = require('axios');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

const PORT = 3000;
const API_KEY = '3293f698ecmsh61d517a0ce65b6cp1e527ajsne278f7c63c74'; // Teri Key

app.get('/', async (req, res) => {
    // Inputs
    const keyword = req.query.keyword || 'Sustainability'; 
    const location = req.query.location || 'India';
    const workType = req.query.work_type || ''; 
    const source = req.query.source || 'linkedin'; 

    let results = [];
    let error = null;

    try {
        if (source === 'linkedin') {
            // --- CORPORATE JOBS (Load 100+) ---
            // 'site:linkedin.com' hata diya taaki Indeed/Glassdoor sab aaye
            const linkedInQuery = `${keyword} ${workType} jobs in ${location}`;
            
            console.log(`Fetching 100 Corporate Jobs: ${linkedInQuery}...`);
            
            const options = {
                method: 'GET',
                url: 'https://jsearch.p.rapidapi.com/search',
                params: {
                    query: linkedInQuery, 
                    num_pages: '10', // <--- YAHAN HAI MAGIC (10 Pages x 10 Jobs = 100 Jobs)
                    date_posted: 'month' 
                },
                headers: {
                    'X-RapidAPI-Key': API_KEY,
                    'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
                }
            };
            const response = await axios.request(options);
            results = response.data.data || [];

        } else if (source === 'twitter') {
            // --- TWITTER DIRECT ---
            const twitterQuery = `"${keyword}" (hiring OR email OR "send cv" OR "dm to apply") -filter:retweets`;
            console.log(`Fetching Tweets: ${twitterQuery}...`);

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
            results = response.data.timeline || [];
        }

    } catch (err) {
        console.error("API Error:", err.message);
        error = "Network error. Try refreshing.";
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

app.listen(PORT, () => { console.log(`Bulk Job Board Live: http://localhost:${PORT}`); });
const express = require('express');
const axios = require('axios');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

// --- SETTINGS ---
const PORT = 3000;
const API_KEY = '72c2201404mshc83a7b237fe0efdp1d6743jsn507eda571608'; // Teri Key
const API_HOST = 'jsearch.p.rapidapi.com';

// --- CACHE (Homepage ke liye) ---
let cachedJobs = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 Ghanta

// 1. HOME PAGE ROUTE (Fixed: Smart & Broad Search)
app.get('/', async (req, res) => {
    
    // User Inputs
    const keyword = req.query.keyword || ''; 
    const location = req.query.location || '';
    const jobType = req.query.job_type || ''; 

    // Check agar sab khali hai (Default load)
    const isDefaultSearch = (!keyword && !location && !jobType);

    // --- SMART QUERY LOGIC ---
    let searchQuery = '';
    
    // CHANGE 1: Default keyword ko thoda broad rakha hai ('Sustainability')
    // Agar user ne box khali chhoda hai, toh hum 'Sustainability' search karenge.
    const effectiveKeyword = keyword ? keyword : 'Sustainability';

    // CHANGE 2: 'On-site' logic fix
    // Agar 'Remote' ya 'Hybrid' hai toh query mein jodenge.
    // Agar 'On-site' hai, toh query mein kuch nahi jodenge (kyunki default jobs on-site hi hoti hain).
    let typeFilter = '';
    if (jobType === 'Remote' || jobType === 'Hybrid') {
        typeFilter = jobType; 
    }

    if (isDefaultSearch) {
        searchQuery = 'Sustainability Jobs in India';
    } else {
        // Query Construction:
        // Example 1 (Remote): "Remote Sustainability jobs in USA"
        // Example 2 (On-site): "Sustainability jobs in USA" (On-site word hat gaya taaki zyada results milein)
        searchQuery = `${typeFilter} ${effectiveKeyword} jobs in ${location}`.trim();
    }

    const currentTime = Date.now();
    
    // Cache Check (Sirf Default page ke liye)
    if (isDefaultSearch && cachedJobs && (currentTime - lastFetchTime < CACHE_DURATION)) {
        console.log('Serving Default Cache...');
        return res.render('index', { 
            jobs: cachedJobs, 
            searchParams: { keyword, location, job_type: jobType } 
        });
    }

    console.log(`Fetching Live Data: "${searchQuery}"...`);
    
    const options = {
        method: 'GET',
        url: `https://${API_HOST}/search`,
        params: {
            query: searchQuery,
            num_pages: '10', // 100 Jobs target
            date_posted: 'month'
        },
        headers: {
            'X-RapidAPI-Key': API_KEY,
            'X-RapidAPI-Host': API_HOST
        }
    };

    try {
        const response = await axios.request(options);
        const fetchedJobs = response.data.data;

        if (isDefaultSearch) {
            cachedJobs = fetchedJobs;
            lastFetchTime = currentTime;
        }

        res.render('index', { 
            jobs: fetchedJobs, 
            searchParams: { keyword, location, job_type: jobType } 
        });

    } catch (error) {
        console.error("Search Error:", error.message);
        // Error aaye toh bhi agar cache hai toh woh dikha do
        if (cachedJobs) {
            res.render('index', { 
                jobs: cachedJobs, 
                searchParams: { keyword, location, job_type: jobType },
                error: "Network error, showing offline data."
            });
        } else {
            res.send("<h1>API Limit Exceeded or Error. Check Console.</h1>");
        }
    }
});

// 2. JOB DETAILS ROUTE (Safe Version)
app.get('/job', async (req, res) => {
    const jobId = req.query.id;

    if (!jobId) return res.send("No Job ID provided");

    const options = {
        method: 'GET',
        url: `https://${API_HOST}/job-details`,
        params: {
            job_id: jobId,
            extended_publisher_details: 'false'
        },
        headers: {
            'X-RapidAPI-Key': API_KEY,
            'X-RapidAPI-Host': API_HOST
        }
    };

    try {
        const response = await axios.request(options);
        
        // Safety Check: Agar job data khali hai
        if (!response.data.data || response.data.data.length === 0) {
            return res.send(`
                <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                    <h1 style="color: #e53e3e;">Job Not Found</h1>
                    <p style="color: #4a5568;">Sorry, this job might have expired.</p>
                    <a href="/" style="display: inline-block; margin-top: 20px; background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Back to Home</a>
                </div>
            `);
        }

        const jobData = response.data.data[0];
        res.render('job-details', { job: jobData });

    } catch (error) {
        console.error("Details Error:", error.message);
        res.send("<h1>Error fetching details. Try again later.</h1>");
    }
});

app.listen(PORT, () => {
    console.log(`Project Live: http://localhost:${PORT}`);
});
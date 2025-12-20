const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

const PORT = 3000;

// --- 🔑 API KEYS & DB ---
const API_KEY = '15ecf5c2e1msha76c0e9843b9e44p10032bjsn8fc2c9cbe2d8'; 
const MONGO_URI = 'mongodb+srv://chiragmehtaa:Nd0OjDrZC00MusR2@cluster0.vmkhfa6.mongodb.net/ecocareers?appName=Cluster0';

// --- 🌍 HOSTS ---
const GOOGLE_HOST = 'google-search74.p.rapidapi.com';
const TWITTER_HOST = 'twitter-api45.p.rapidapi.com';

// --- 📦 DATABASE ---
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Atlas Connected!"))
    .catch(err => console.error("❌ DB Connection Error:", err));

const jobSchema = new mongoose.Schema({
    job_id: { type: String, unique: true }, 
    job_title: String,
    employer_name: String,
    employer_logo: String,
    job_city: String,
    link: { type: String, unique: true }, 
    text: String,
    source: String,
    category: String,
    date_added: { type: Date, default: Date.now }
});

const Job = mongoose.model('Job', jobSchema);

// --- 📅 HELPERS ---
function getDateFilter() {
    const date = new Date();
    date.setMonth(date.getMonth() - 2); 
    return date.toISOString().split('T')[0]; 
}

function getBroadKeywords(category) {
    if (category === 'ESG') return '("ESG" OR "Sustainability" OR "Climate" OR "Green Energy")';
    if (category === 'Developer') return '("Developer" OR "Software Engineer" OR "Web Developer" OR "React")';
    if (category === 'Business') return '("Business Analyst" OR "Sales" OR "BDM")';
    if (category === 'Marketing') return '("Marketing" OR "SEO" OR "Social Media")';
    if (category === 'Data') return '("Data Analyst" OR "Data Scientist")';
    return `"${category}"`; 
}

// --- 🧹 CLEANER ROUTE ---
app.get('/admin/clear', async (req, res) => {
    try {
        await Job.deleteMany({});
        res.send("<h1>✅ Database Cleared!</h1><p>Bad links removed. Go back to <a href='/'>App</a> and refresh.</p>");
    } catch(e) { res.send(e.message); }
});

app.get('/', (req, res) => res.redirect('/app?category=ESG'));

// --- 🚀 MAIN APP ---
app.get('/app', async (req, res) => {
    const source = req.query.source || 'linkedin'; 
    const category = req.query.category || 'ESG'; 
    const forceRefresh = req.query.refresh === 'true';

    let results = [];
    let error = null;

    try {
        // 1. CHECK DB
        if (!forceRefresh) {
            const dbJobs = await Job.find({ 
                source: source, 
                category: { $regex: new RegExp(category, "i") } 
            }).sort({ date_added: -1 }).limit(50);
            
            if (dbJobs.length > 0) results = dbJobs;
        }

        // 2. FETCH FRESH DATA
        if (results.length === 0 || forceRefresh) {
            console.log(`Fetching FRESH Data for: ${category}`);
            const dateStr = getDateFilter(); 
            const searchTerms = getBroadKeywords(category);
            let newJobs = [];

            if (source === 'linkedin') {
                // GOOGLE QUERY
                const googleQuery = `site:linkedin.com/posts ${searchTerms} ("hiring" OR "vacancy") ("gmail.com" OR "send cv") after:${dateStr}`;

                const options = {
                    method: 'GET',
                    url: `https://${GOOGLE_HOST}/`,
                    params: { query: googleQuery, limit: '20', related_keywords: 'true' },
                    headers: { 'X-RapidAPI-Key': API_KEY, 'X-RapidAPI-Host': GOOGLE_HOST }
                };
                
                const response = await axios.request(options);
                const rawData = response.data.results || response.data.items || [];

                // MAP & FILTER
                newJobs = rawData.map(item => ({
                    job_id: Math.random().toString(36).substr(2, 9),
                    job_title: (item.title || "Hiring Update").substring(0, 100), 
                    employer_name: "LinkedIn Recruiter", 
                    employer_logo: "https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png",
                    link: item.url || item.link, 
                    text: item.description || item.snippet || "Check details...",
                    source: 'linkedin',
                    category: category,
                    job_city: "Direct Post"
                })).filter(job => {
                    // 🛡️ STRICT FILTER: Sirf Valid Posts allow karo
                    return job.link && (
                        job.link.includes('/posts/') || 
                        job.link.includes('/activity/') ||
                        job.link.includes('urn:li:activity')
                    );
                });

            } else if (source === 'twitter') {
                const twQuery = `${searchTerms} ("hiring" OR "jobs") ("send cv" OR "email" OR "gmail.com") -filter:retweets`;
                const options = {
                    method: 'GET',
                    url: `https://${TWITTER_HOST}/search.php`, 
                    params: { query: twQuery, search_type: 'Latest' },
                    headers: { 'X-RapidAPI-Key': API_KEY, 'X-RapidAPI-Host': TWITTER_HOST }
                };
                const response = await axios.request(options);
                let rawTweets = response.data.timeline || [];

                newJobs = rawTweets.map(t => ({
                    job_id: t.tweet_id,
                    job_title: t.name,
                    employer_name: "Twitter Recruiter",
                    employer_logo: "https://upload.wikimedia.org/wikipedia/commons/c/ce/X_logo_2023.svg",
                    link: `https://x.com/${t.screen_name}/status/${t.tweet_id}`,
                    text: t.text,
                    source: 'twitter',
                    category: category,
                    job_city: "Remote"
                }));
            }

            // 3. UPSERT TO DB
            if (newJobs.length > 0) {
                for (let job of newJobs) {
                    await Job.updateOne(
                        { link: job.link }, 
                        { $set: job, $setOnInsert: { date_added: new Date() } },
                        { upsert: true }
                    );
                }
                results = await Job.find({ source: source, category: category }).sort({ date_added: -1 }).limit(50);
            } else {
                error = `No fresh posts found for ${category}.`;
            }
        }

    } catch (err) {
        console.error("Error:", err.message);
        results = await Job.find({ source: source, category: category }).sort({ date_added: -1 }).limit(50);
    }

    res.render('index', { results, source, category, error });
});

app.listen(PORT, () => console.log(`🔥 Server Live: http://localhost:${PORT}`));
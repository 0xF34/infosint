const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '32kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));
app.use(express.static(path.join(__dirname, 'public')));

async function githubFetch(url) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'infosint-github-recon/1.0' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(url, { headers });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!response.ok) {
    const error = new Error(data?.message || `GitHub API returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

app.get('/api/health', (_req, res) => res.json({ ok: true, module: 'github-recon' }));

app.get('/api/github', async (req, res) => {
  const username = String(req.query.username || '').trim();
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) return res.status(400).json({ error: 'Enter a valid GitHub username.' });

  try {
    const base = `https://api.github.com/users/${encodeURIComponent(username)}`;
    const [profile, repos, events, gists] = await Promise.all([
      githubFetch(base),
      githubFetch(`${base}/repos?per_page=100&sort=updated&type=all`),
      githubFetch(`${base}/events/public?per_page=30`),
      githubFetch(`${base}/gists?per_page=100`)
    ]);

    res.json({
      profile: {
        login: profile.login, id: profile.id, avatar_url: profile.avatar_url, html_url: profile.html_url,
        name: profile.name, company: profile.company, blog: profile.blog, location: profile.location,
        bio: profile.bio, public_email: profile.email || null, twitter_username: profile.twitter_username,
        public_repos: profile.public_repos, public_gists: profile.public_gists, followers: profile.followers,
        following: profile.following, created_at: profile.created_at, updated_at: profile.updated_at,
        hireable: profile.hireable
      },
      repos: repos.map(r => ({ id:r.id,name:r.name,full_name:r.full_name,description:r.description,html_url:r.html_url,language:r.language,stargazers_count:r.stargazers_count,forks_count:r.forks_count,watchers_count:r.watchers_count,open_issues_count:r.open_issues_count,topics:r.topics||[],fork:r.fork,archived:r.archived,pushed_at:r.pushed_at,updated_at:r.updated_at })),
      events: events.map(e => ({ id:e.id,type:e.type,created_at:e.created_at,repo:e.repo?{name:e.repo.name,url:`https://github.com/${e.repo.name}`}:null,action:e.payload?.action||null,ref:e.payload?.ref||null,issue:e.payload?.issue?{number:e.payload.issue.number,title:e.payload.issue.title,html_url:e.payload.issue.html_url}:null,pull_request:e.payload?.pull_request?{number:e.payload.pull_request.number,title:e.payload.pull_request.title,html_url:e.payload.pull_request.html_url}:null })),
      gists: gists.map(g => ({ id:g.id,description:g.description,public:g.public,html_url:g.html_url,created_at:g.created_at,updated_at:g.updated_at,files:Object.keys(g.files||{}) })),
      limits: { repos:'First 100 repositories', events:'Latest 30 public events', gists:'First 100 gists' }
    });
  } catch (error) {
    res.status(error.status === 404 ? 404 : 502).json({ error: error.message });
  }
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`infosint listening on ${PORT}`));

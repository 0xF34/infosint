const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));

const USER_RE = /^[A-Za-z0-9-]{1,39}$/;
const cache = new Map();
const CACHE_MS = 60000;

async function githubFetch(url) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'infosint/1.0' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const r = await fetch(url, { headers });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = { message: text }; }
  if (!r.ok) { const e = new Error(data.message || `GitHub returned ${r.status}`); e.status = r.status; throw e; }
  return data;
}
async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < CACHE_MS) return hit.value;
  const value = await fn(); cache.set(key, { time: Date.now(), value }); return value;
}
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'infosint-github' }));
app.get('/api/github', async (req, res) => {
  const username = String(req.query.username || '').trim();
  if (!USER_RE.test(username)) return res.status(400).json({ error: 'Enter a valid GitHub username.' });
  try {
    const base = `https://api.github.com/users/${encodeURIComponent(username)}`;
    const [profile, repos, events, gists] = await Promise.all([
      cached(`p:${username}`, () => githubFetch(base)),
      cached(`r:${username}`, () => githubFetch(`${base}/repos?per_page=100&sort=updated&type=all`)),
      cached(`e:${username}`, () => githubFetch(`${base}/events/public?per_page=30`)),
      cached(`g:${username}`, () => githubFetch(`${base}/gists?per_page=100`))
    ]);
    res.json({
      profile: { login: profile.login, id: profile.id, avatar_url: profile.avatar_url, html_url: profile.html_url, name: profile.name, company: profile.company, blog: profile.blog, location: profile.location, bio: profile.bio, public_email: profile.email || null, twitter_username: profile.twitter_username, public_repos: profile.public_repos, public_gists: profile.public_gists, followers: profile.followers, following: profile.following, created_at: profile.created_at, updated_at: profile.updated_at, hireable: profile.hireable },
      repos: repos.map(r => ({ id:r.id,name:r.name,full_name:r.full_name,description:r.description,html_url:r.html_url,language:r.language,stargazers_count:r.stargazers_count,forks_count:r.forks_count,open_issues_count:r.open_issues_count,fork:r.fork,archived:r.archived,pushed_at:r.pushed_at,updated_at:r.updated_at,default_branch:r.default_branch,visibility:r.visibility })),
      events: events.map(e => ({ id:e.id,type:e.type,created_at:e.created_at,repo:e.repo?{name:e.repo.name,url:`https://github.com/${e.repo.name}`}:null,action:e.payload?.action||null,ref:e.payload?.ref||null,public:e.public })),
      gists: gists.map(g => ({ id:g.id,description:g.description,public:g.public,html_url:g.html_url,created_at:g.created_at,updated_at:g.updated_at,files:Object.keys(g.files||{}) })),
      meta: { repository_limit:100, event_limit:30, gist_limit:100, note:'Results are limited to data exposed by GitHub public APIs.' }
    });
  } catch (e) { res.status(e.status === 404 ? 404 : 502).json({ error: e.message }); }
});
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`infosint listening on ${PORT}`));

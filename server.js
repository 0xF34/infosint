const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 10000;

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const USER_RE = /^[A-Za-z0-9-]{1,39}$/;
const cache = new Map();
const CACHE_MS = 60000;

async function githubFetch(url) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'infosint/1.0'
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });
  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const error = new Error(data.message || `GitHub returned ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < CACHE_MS) return hit.value;

  const value = await fn();
  cache.set(key, { time: Date.now(), value });
  return value;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'infosint-github' });
});

app.get('/api/github', async (req, res) => {
  const username = String(req.query.username || '').trim();

  if (!USER_RE.test(username)) {
    return res.status(400).json({ error: 'Enter a valid GitHub username.' });
  }

  try {
    const base = `https://api.github.com/users/${encodeURIComponent(username)}`;

    const [profile, repos, events, gists] = await Promise.all([
      cached(`p:${username}`, () => githubFetch(base)),
      cached(`r:${username}`, () => githubFetch(`${base}/repos?per_page=100&sort=updated&type=all`)),
      cached(`e:${username}`, () => githubFetch(`${base}/events/public?per_page=30`)),
      cached(`g:${username}`, () => githubFetch(`${base}/gists?per_page=100`))
    ]);

    res.json({
      profile: {
        login: profile.login,
        id: profile.id,
        avatar_url: profile.avatar_url,
        html_url: profile.html_url,
        name: profile.name,
        company: profile.company,
        blog: profile.blog,
        location: profile.location,
        bio: profile.bio,
        public_email: profile.email || null,
        twitter_username: profile.twitter_username,
        public_repos: profile.public_repos,
        public_gists: profile.public_gists,
        followers: profile.followers,
        following: profile.following,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        hireable: profile.hireable
      },
      repos: repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        html_url: repo.html_url,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        open_issues_count: repo.open_issues_count,
        fork: repo.fork,
        archived: repo.archived,
        pushed_at: repo.pushed_at,
        updated_at: repo.updated_at,
        default_branch: repo.default_branch,
        visibility: repo.visibility
      })),
      events: events.map((event) => ({
        id: event.id,
        type: event.type,
        created_at: event.created_at,
        repo: event.repo ? {
          name: event.repo.name,
          url: `https://github.com/${event.repo.name}`
        } : null,
        action: event.payload?.action || null,
        ref: event.payload?.ref || null,
        public: event.public
      })),
      gists: gists.map((gist) => ({
        id: gist.id,
        description: gist.description,
        public: gist.public,
        html_url: gist.html_url,
        created_at: gist.created_at,
        updated_at: gist.updated_at,
        files: Object.keys(gist.files || {})
      })),
      meta: {
        repository_limit: 100,
        event_limit: 30,
        gist_limit: 100,
        note: 'Results are limited to data exposed by GitHub public APIs.'
      }
    });
  } catch (error) {
    res.status(error.status === 404 ? 404 : 502).json({ error: error.message });
  }
});

// Express 5-compatible SPA fallback. Only send index.html for browser navigation requests.
app.use((req, res, next) => {
  if (req.method === 'GET' && req.accepts('html')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`infosint listening on ${PORT}`);
});

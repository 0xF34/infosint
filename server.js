const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const cache = { whm: null, whmAt: 0 };

app.use(express.json({ limit: '64kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));
app.use(express.static(path.join(__dirname, 'public')));

const envOrHeader = (env, req, name) => process.env[env] || req.get(name) || '';
const safeFetch = async (url, options = {}) => {
  const r = await fetch(url, { ...options, headers: { 'User-Agent': 'infosint/1.0', ...(options.headers || {}) } });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`${r.status}: ${typeof data === 'string' ? data.slice(0, 180) : (data.message || 'upstream error')}`);
  return data;
};

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'infosint' }));

app.get('/api/ip', async (req, res) => {
  try {
    const ip = req.query.ip || '';
    const geo = await safeFetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,isp,org,as,query`);
    if (geo.status !== 'success') throw new Error(geo.message || 'IP lookup failed');
    const out = { ...geo, enrichments: {} };
    const ipinfo = envOrHeader('IPINFO_TOKEN', req, 'X-IPINFO-TOKEN');
    if (ipinfo) { try { out.enrichments.ipinfo = await safeFetch(`https://ipinfo.io/${encodeURIComponent(geo.query)}/json?token=${encodeURIComponent(ipinfo)}`); } catch (e) { out.enrichments.ipinfoError = e.message; } }
    const shodan = envOrHeader('SHODAN_API_KEY', req, 'X-SHODAN-KEY');
    if (shodan) { try { out.enrichments.shodan = await safeFetch(`https://api.shodan.io/shodan/host/${encodeURIComponent(geo.query)}?key=${encodeURIComponent(shodan)}`); } catch (e) { out.enrichments.shodanError = e.message; } }
    const vt = envOrHeader('VIRUSTOTAL_API_KEY', req, 'X-VT-KEY');
    if (vt) { try { out.enrichments.virustotal = await safeFetch(`https://www.virustotal.com/api/v3/ip_addresses/${encodeURIComponent(geo.query)}`, { headers: { 'x-apikey': vt } }); } catch (e) { out.enrichments.virustotalError = e.message; } }
    const abuse = envOrHeader('ABUSEIPDB_API_KEY', req, 'X-ABUSEIPDB-KEY');
    if (abuse) { try { out.enrichments.abuseipdb = await safeFetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(geo.query)}&maxAgeInDays=90`, { headers: { Key: abuse, Accept: 'application/json' } }); } catch (e) { out.enrichments.abuseipdbError = e.message; } }
    res.json(out);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/api/username', async (req, res) => {
  try {
    if (!cache.whm || Date.now() - cache.whmAt > 6 * 60 * 60 * 1000) {
      cache.whm = await safeFetch('https://raw.githubusercontent.com/webbreacher/whatsmyname/main/web.json');
      cache.whmAt = Date.now();
    }
    const username = String(req.query.username || '').trim();
    if (!/^[a-zA-Z0-9._-]{1,64}$/.test(username)) return res.status(400).json({ error: 'Invalid username' });
    const sites = Array.isArray(cache.whm) ? cache.whm : (cache.whm.sites || cache.whm);
    const definitions = sites.slice(0, 200);
    const results = await Promise.all(definitions.map(async site => {
      const name = site.name || site.id || 'Unknown';
      const uri = site.uri_check || site.url || site.uri_pretty || '';
      if (!uri) return { name, status: 'UNKNOWN', url: '' };
      const url = uri.replace('{account}', encodeURIComponent(username)).replace('{username}', encodeURIComponent(username));
      try {
        const r = await fetch(url, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': 'infosint/1.0' } });
        const found = r.status >= 200 && r.status < 400 && r.status !== 404;
        return { name, status: found ? 'FOUND' : 'NOT_FOUND', url: found ? url : '', favicon: site.favicon || '' };
      } catch { return { name, status: 'UNKNOWN', url: '' }; }
    }));
    res.json({ username, total: results.length, found: results.filter(x => x.status === 'FOUND').length, results });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/api/email', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
  const out = { email, hibp: null, hunter: null };
  try {
    const key = envOrHeader('HIBP_API_KEY', req, 'X-HIBP-KEY');
    if (key) out.hibp = await safeFetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`, { headers: { 'hibp-api-key': key, 'accept': 'application/json' } });
    else out.hibp = { unavailable: true, message: 'HIBP_API_KEY is not configured' };
  } catch (e) { out.hibp = { error: e.message }; }
  const hunter = envOrHeader('HUNTER_API_KEY', req, 'X-HUNTER-KEY');
  if (hunter) { try { out.hunter = await safeFetch(`https://hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${encodeURIComponent(hunter)}`); } catch (e) { out.hunter = { error: e.message }; } }
  else out.hunter = { unavailable: true, message: 'HUNTER_API_KEY is not configured' };
  res.json(out);
});

app.get('/api/breach', async (req, res) => {
  const query = String(req.query.query || '').trim();
  if (!query) return res.status(400).json({ error: 'Email or domain required' });
  if (!query.includes('@')) return res.status(400).json({ error: 'Domain-only breach enumeration is not enabled; enter an authorized email address.' });
  const key = envOrHeader('HIBP_API_KEY', req, 'X-HIBP-KEY');
  if (!key) return res.status(400).json({ error: 'HIBP_API_KEY is not configured' });
  try { res.json({ query, breaches: await safeFetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(query)}?truncateResponse=false`, { headers: { 'hibp-api-key': key, accept: 'application/json' } }) }); }
  catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/api/github', async (req, res) => {
  const username = String(req.query.username || '').trim();
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) return res.status(400).json({ error: 'Invalid GitHub username' });
  try {
    const h = {};
    if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const [profile, repos, events, gists] = await Promise.all([
      safeFetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers: h }),
      safeFetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`, { headers: h }),
      safeFetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=30`, { headers: h }),
      safeFetch(`https://api.github.com/users/${encodeURIComponent(username)}/gists?per_page=100`, { headers: h })
    ]);
    res.json({ profile, repos, events, gists: gists.map(g => ({ id: g.id, description: g.description, public: g.public, created_at: g.created_at, updated_at: g.updated_at, html_url: g.html_url, files: Object.keys(g.files || {}) })) });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/api/discord', async (req, res) => {
  const id = String(req.query.id || '').trim();
  if (!/^\d{17,20}$/.test(id)) return res.status(400).json({ error: 'Valid Discord user ID required' });
  const token = envOrHeader('DISCORD_BOT_TOKEN', req, 'X-DISCORD-TOKEN');
  if (!token) return res.status(400).json({ error: 'DISCORD_BOT_TOKEN is not configured' });
  try {
    const user = await safeFetch(`https://discord.com/api/v10/users/${id}`, { headers: { Authorization: `Bot ${token}` } });
    res.json({ user });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`infosint listening on ${PORT}`));

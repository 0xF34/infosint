const $ = s => document.querySelector(s);
const results = $('#results');
const sidebar = $('#sidebar');

$('#hamb').addEventListener('click', () => sidebar.classList.toggle('open'));
$('#githubTab').addEventListener('click', () => sidebar.classList.remove('open'));
$('#username').addEventListener('keydown', e => { if (e.key === 'Enter') runRecon(); });
$('#search').addEventListener('click', runRecon);

function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function date(v) { if (!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(); }
function card(title, body, cls='') { return `<article class="card ${cls}"><div class="card-head"><h3>${title}</h3></div>${body}</article>`; }

async function runRecon() {
  const username = $('#username').value.trim();
  if (!/^[A-Za-z0-9-]{1,39}$/.test(username)) {
    results.innerHTML = '<div class="empty error"><h2>Invalid username</h2><p>Use a valid GitHub username.</p></div>';
    return;
  }
  const button = $('#search'); button.disabled = true; button.textContent = 'Scanning...';
  results.innerHTML = `<div class="loading"><span></span><span></span><span></span><p>Querying GitHub public endpoints for <b>${esc(username)}</b>...</p></div>`;
  try {
    const r = await fetch(`/api/github?username=${encodeURIComponent(username)}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'GitHub request failed');
    render(data);
  } catch (e) {
    results.innerHTML = `<div class="empty error"><h2>Recon failed</h2><p>${esc(e.message)}</p></div>`;
  } finally { button.disabled = false; button.textContent = 'Run Recon'; }
}

function render(d) {
  const p = d.profile, repos = d.repos || [], events = d.events || [], gists = d.gists || [];
  const repoRows = repos.map(r => `<div class="repo-row"><div><a href="${esc(r.html_url)}" target="_blank" rel="noopener">${esc(r.name)}</a><p>${esc(r.description || 'No description')}</p></div><div class="repo-meta"><span>${esc(r.language || 'Unknown')}</span><span>★ ${r.stargazers_count}</span><span>⑂ ${r.forks_count}</span></div></div>`).join('') || '<div class="muted">No public repositories.</div>';
  const eventRows = events.map(e => `<div class="event"><div class="event-dot"></div><div><b>${esc(e.type)}</b><p>${e.repo ? `<a href="${esc(e.repo.url)}" target="_blank" rel="noopener">${esc(e.repo.name)}</a>` : 'GitHub'}</p></div><time>${date(e.created_at)}</time></div>`).join('') || '<div class="muted">No recent public events.</div>';
  const gistRows = gists.map(g => `<div class="gist-row"><div><a href="${esc(g.html_url)}" target="_blank" rel="noopener">${esc(g.description || 'Untitled gist')}</a><p>${g.files.length} file${g.files.length === 1 ? '' : 's'} · ${g.public ? 'Public' : 'Private visibility'}</p></div><time>${date(g.updated_at)}</time></div>`).join('') || '<div class="muted">No public gists.</div>';
  const avatar = p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="" class="avatar">` : '<div class="avatar fallback">GH</div>';
  results.innerHTML = `
    <div class="overview">${avatar}<div class="identity"><div class="handle">@${esc(p.login)}</div><h2>${esc(p.name || p.login)}</h2><p>${esc(p.bio || 'No public bio')}</p><a href="${esc(p.html_url)}" target="_blank" rel="noopener">Open GitHub profile ↗</a></div><div class="stats"><div><b>${p.public_repos}</b><span>Repos</span></div><div><b>${p.public_gists}</b><span>Gists</span></div><div><b>${p.followers}</b><span>Followers</span></div><div><b>${p.following}</b><span>Following</span></div></div></div>
    <div class="grid two">
      ${card('Profile Intelligence', `<dl><dt>GitHub ID</dt><dd>${esc(p.id)}</dd><dt>Location</dt><dd>${esc(p.location || 'Not public')}</dd><dt>Company</dt><dd>${esc(p.company || 'Not public')}</dd><dt>Website</dt><dd>${p.blog ? `<a href="${esc(p.blog)}" target="_blank" rel="noopener">${esc(p.blog)}</a>` : 'Not public'}</dd><dt>Public email</dt><dd>${p.public_email ? esc(p.public_email) : 'Not public'}</dd><dt>Twitter</dt><dd>${esc(p.twitter_username ? '@'+p.twitter_username : 'Not public')}</dd><dt>Created</dt><dd>${date(p.created_at)}</dd><dt>Updated</dt><dd>${date(p.updated_at)}</dd></dl>`)}
      ${card('Repository Overview', `<div class="repo-list">${repoRows}</div>`)}
      ${card('Public Activity', `<div class="timeline">${eventRows}</div>`)}
      ${card('Public Gists', `<div class="gist-list">${gistRows}</div>`)}
    </div>
    <div class="notice"><b>Data scope</b><span>Only information returned by GitHub's public API is displayed. Repository results are capped at 100, public events at 30, and gists at 100.</span></div>`;
}

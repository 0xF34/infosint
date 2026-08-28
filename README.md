# infosint

A focused dark GitHub Recon dashboard for public-data research.

## Current module

Only **GitHub Recon** is enabled in this first build. The sidebar contains one GitHub tab with the GitHub logo. Additional OSINT modules can be added incrementally after the base deployment is stable.

### What it checks

- Public GitHub profile information
- Public profile email, when GitHub exposes one
- Account ID, name, company, location, website, bio, social username
- Repository list with language, stars, forks, issues, visibility, archive state, and links
- Latest public activity events
- Public gists, descriptions, file names, timestamps, and links
- Account creation/update timestamps
- Followers, following, public repository count, and public gist count

The backend uses GitHub's public API and does not scrape private pages or bypass authentication. Results are capped at 100 repositories, 30 public events, and 100 gists per lookup.

## Deploy on Render

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Environment: `NODE_ENV=production`
- Optional: `GITHUB_TOKEN` for an authorized GitHub token with appropriate API access and higher rate limits

No database is required.

## Structure

```text
infosint/
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── package.json
├── server.js
└── README.md
```

## API

`GET /api/health` — service health check.

`GET /api/github?username=<username>` — returns public profile, repositories, public activity, and public gists.

## Notes

Use the application for authorized research and comply with GitHub's API terms and rate limits. The project intentionally displays information exposed through GitHub's public API rather than attempting to obtain private account data or aggregate hidden personal contact information.

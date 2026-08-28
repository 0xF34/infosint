# infosint

A dark, single-service OSINT dashboard for authorized research and public-data investigation.

## Deploy on Render

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Environment: `NODE_ENV=production`

No database is required. API credentials are supplied through Render environment variables and are never committed to the repository.

## Environment variables

| Variable | Service | Signup / API page |
|---|---|---|
| `HIBP_API_KEY` | Have I Been Pwned | https://haveibeenpwned.com/API/Key |
| `HUNTER_API_KEY` | Hunter | https://hunter.io/users/sign_up |
| `IPINFO_TOKEN` | IPinfo | https://ipinfo.io/signup |
| `SHODAN_API_KEY` | Shodan | https://account.shodan.io/register |
| `VIRUSTOTAL_API_KEY` | VirusTotal | https://www.virustotal.com/gui/join-us |
| `ABUSEIPDB_API_KEY` | AbuseIPDB | https://www.abuseipdb.com/account/signup |
| `CENSYS_API_ID` / `CENSYS_API_SECRET` | Censys | https://app.censys.io/register |
| `SECURITYTRAILS_API_KEY` | SecurityTrails | https://securitytrails.com/signup |
| `LEAKCHECK_API_KEY` | LeakCheck | https://leakcheck.io/ |
| `DISCORD_BOT_TOKEN` | Discord Developer API | https://discord.com/developers/applications |

The UI also accepts optional client-side credentials in localStorage for development, but server environment variables take precedence. Never paste production secrets into a public repository.

## Included data sources

- GitHub public API
- IP-API
- IPinfo (optional)
- Shodan (optional)
- VirusTotal (optional)
- AbuseIPDB (optional)
- Have I Been Pwned (optional API key)
- Hunter (optional)
- WhatsMyName public site definitions
- Discord API for authorized bot access

## Privacy and authorization

Use this project only with information you are authorized to investigate. The GitHub module intentionally limits itself to public account/repository/activity metadata and does not implement bulk harvesting of personal email addresses. Discord requests require an authorized bot token and only return data available to that token.

## License

Use responsibly and comply with each provider's terms, rate limits, and API policies.

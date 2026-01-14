# octokit-load-balancer

> Load balance across multiple GitHub App instances, always picking the one with most available rate limit

[![npm version](https://img.shields.io/npm/v/octokit-load-balancer.svg)](https://www.npmjs.com/package/octokit-load-balancer)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Features

- **Multiple App Support** - Pool multiple GitHub Apps for higher aggregate rate limits
- **Smart Selection** - Always picks the app with the most available rate limit
- **Auto Key Detection** - Automatically detects raw PEM vs base64 encoded private keys
- **TypeScript First** - Full type definitions using Octokit types
- **Single Function API** - Just one function: `getApp`

## Installation

```bash
npm install octokit-load-balancer octokit @octokit/auth-app
```

## Usage

```typescript
import { getApp } from 'octokit-load-balancer';

const octokit = await getApp({
  apps: [
    {
      appId: process.env.GH_APP_1_ID,
      installationId: process.env.GH_APP_1_INSTALLATION_ID,
      privateKey: process.env.GH_APP_1_KEY,
    },
    {
      appId: process.env.GH_APP_2_ID,
      installationId: process.env.GH_APP_2_INSTALLATION_ID,
      privateKey: process.env.GH_APP_2_KEY,
    },
  ],
  baseUrl: 'https://api.github.com',
});

await octokit.rest.repos.get({ owner: 'your-org', repo: 'your-repo' });
```

## How It Works

Every time you call `getApp(config)`:

1. Creates Octokit instances for all valid app configs
2. Fetches rate limits for all apps in parallel
3. Returns the Octokit with the highest remaining rate limit

## Options

| Option    | Type                | Required | Description                 |
| --------- | ------------------- | -------- | --------------------------- |
| `apps`    | `GitHubAppConfig[]` | Yes      | Array of app configurations |
| `baseUrl` | `string`            | Yes      | GitHub API base URL         |

App configs use `GitHubAppConfig` (re-exported from `@octokit/auth-app`'s `StrategyOptions`). All apps must have valid `appId` and `privateKey` — incomplete configs will throw an error.

## Comparison with @octokit/plugin-throttling

[`@octokit/plugin-throttling`](https://github.com/octokit/plugin-throttling.js) handles rate limits by queuing and retrying requests. This library takes a different approach: distribute load across multiple GitHub Apps to maximize available quota.

|                    | octokit-load-balancer              | plugin-throttling         |
| ------------------ | ---------------------------------- | ------------------------- |
| Strategy           | Pick app with most remaining quota | Queue and retry on limits |
| Multiple apps      | Yes                                | No                        |
| Handles exhaustion | Throws                             | Waits and retries         |

Choose based on your situation:

- **Need more than 5000 requests/hour?** → Create multiple GitHub Apps and use this library to distribute load across them (N apps = N × 5000 req/hr)
- **Single app, need graceful handling?** → Use plugin-throttling to wait and retry

## Debugging

Enable debug logs with the `DEBUG` environment variable:

```bash
DEBUG=octokit-load-balancer node your-script.js
```

Output:

```
[octokit-load-balancer] Using 2 valid app configs
[octokit-load-balancer] Rate limits: app[0]: 4500/5000, app[1]: 4900/5000
[octokit-load-balancer] Selected app[1] with 4900/5000 remaining
```

## License

MIT

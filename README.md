# octokit-load-balancer

> Load balance across multiple GitHub App instances, always picking the one with most available rate limit

[![npm version](https://img.shields.io/npm/v/octokit-load-balancer.svg)](https://www.npmjs.com/package/octokit-load-balancer)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Features

- **Smart Selection** - Always picks the app with the most available rate limit
- **Auto Key Detection** - Automatically detects raw PEM vs base64 encoded private keys
- **TypeScript First** - Full type definitions using Octokit types
- **Single Function API** - Just one function: `getApp`

## Installation

```bash
npm install octokit-load-balancer
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

1. Creates Octokit instances for each app
2. Fetches rate limits for all apps in parallel
3. Returns the Octokit with the highest remaining rate limit

## Options

| Option    | Type                | Required | Description                 |
| --------- | ------------------- | -------- | --------------------------- |
| `apps`    | `GitHubAppConfig[]` | Yes      | Array of app configurations |
| `baseUrl` | `string`            | Yes      | GitHub API base URL         |

## Scalability

This library is designed for high-throughput scenarios where a single GitHub App's rate limit (5,000 requests/hour) isn't enough. By distributing requests across multiple apps, you get N × 5,000 requests/hour.

## Credits

Thanks [@crash7](https://github.com/crash7) for the core selection logic.

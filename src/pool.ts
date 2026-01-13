import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from 'octokit';

import type {
  GitHubAppConfig,
  GitHubAppPoolConfig,
  RateLimitInfo,
} from './types';

const DEBUG_KEY = 'octokit-load-balancer';

/**
 * Get the Octokit instance with the most available rate limit.
 * Pass your app configurations directly - incomplete configs are filtered out.
 *
 * @example
 * ```typescript
 * import { getApp } from 'octokit-load-balancer'
 *
 * const octokit = await getApp({
 *   apps: [
 *     {
 *       appId: process.env.APP_1_ID,
 *       installationId: process.env.APP_1_INSTALLATION_ID,
 *       privateKey: process.env.APP_1_KEY,
 *     },
 *     {
 *       appId: process.env.APP_2_ID,
 *       installationId: process.env.APP_2_INSTALLATION_ID,
 *       privateKey: process.env.APP_2_KEY,
 *     },
 *   ],
 *   baseUrl: 'https://github.example.com/api/v3',
 * })
 *
 * await octokit.rest.repos.get({ owner: 'org', repo: 'repo' })
 * ```
 *
 * @throws {Error} When no valid app configurations are provided
 */
export async function getApp(config: GitHubAppPoolConfig): Promise<Octokit> {
  if (!Array.isArray(config?.apps)) {
    throw new Error('Invalid config: apps must be an array');
  }
  if (typeof config?.baseUrl !== 'string') {
    throw new Error('Invalid config: baseUrl must be a string');
  }

  if (config.apps.length === 0) {
    throw new Error('Invalid config: apps array is empty');
  }

  const invalidApps = config.apps.filter((app) => !isCompleteConfig(app));

  if (invalidApps.length > 0) {
    throw new Error(
      `Invalid config: ${invalidApps.length} app(s) missing required appId or privateKey`,
    );
  }

  // All apps are valid at this point (type guard passed)
  const validApps = config.apps;

  log(`Using ${validApps.length} valid app configs`);

  const octokits = validApps.map((app) => createOctokit(app, config.baseUrl));
  const rateLimits = await Promise.all(
    octokits.map((o, i) => getRateLimit(o, i)),
  );

  log(
    'Rate limits:',
    rateLimits
      .map((r) => `app[${r.appIndex}]: ${r.remaining}/${r.limit}`)
      .join(', '),
  );

  const { bestIndex, rateLimit } = rateLimits.reduce(
    (acc, cur, i) => {
      if (cur.remaining > acc.rateLimit.remaining) {
        return { bestIndex: i, rateLimit: cur };
      }
      return acc;
    },
    { bestIndex: 0, rateLimit: rateLimits[0] },
  );

  if (rateLimit.remaining === 0) {
    throw new Error('All GitHub Apps have exhausted their rate limits');
  }

  log(
    `Selected app[${bestIndex}] with ${rateLimit.remaining}/${rateLimit.limit} remaining`,
  );

  return octokits[bestIndex];
}

/**
 * Checks if config can satisfy at least one valid auth strategy.
 * Uses runtime checks to validate input, making it safe for JS consumers.
 *
 * Strategies (from @octokit/auth-app):
 * - App auth: appId + privateKey (base, always available)
 * - Installation auth: + installationId
 * - OAuth: + clientId + clientSecret
 */
function isCompleteConfig(config: unknown): config is GitHubAppConfig {
  return (
    typeof config === 'object' &&
    config !== null &&
    'appId' in config &&
    'privateKey' in config &&
    !!(config.appId && config.privateKey)
  );
}

/**
 * Decodes a private key, auto-detecting base64 encoding.
 * PEM keys start with "-----BEGIN", so we can detect raw vs base64.
 */
function decodePrivateKey(key: string): string {
  if (key.startsWith('-----BEGIN ') && key.includes('-----END ')) {
    return key;
  }
  return Buffer.from(key, 'base64').toString('utf-8');
}

/**
 * Creates an Octokit instance from app config
 */
function createOctokit(appConfig: GitHubAppConfig, baseUrl: string): Octokit {
  return new Octokit({
    authStrategy: createAppAuth,
    baseUrl: baseUrl || 'https://api.github.com',
    auth: {
      appId: appConfig.appId,
      installationId: appConfig.installationId,
      privateKey: decodePrivateKey(appConfig.privateKey),
    },
  });
}

/**
 * Get the rate limit for an Octokit instance
 */
async function getRateLimit(
  octokit: Octokit,
  index: number,
): Promise<RateLimitInfo> {
  const response = await octokit.rest.rateLimit.get();
  return {
    ...response.data.rate,
    appIndex: index,
  };
}

function isDebugEnabled(): boolean {
  const debug = process.env.DEBUG;
  if (!debug) return false;
  return debug === '*' || debug.includes(DEBUG_KEY);
}

function log(...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.log(`[${DEBUG_KEY}]`, ...args);
  }
}

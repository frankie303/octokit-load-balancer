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
 * @throws {Error} When no apps are provided or all apps have exhausted their rate limits
 */
export async function getApp(config: GitHubAppPoolConfig): Promise<Octokit> {
  if (!config?.apps?.length) {
    throw new Error('No apps provided');
  }

  log(`Using ${config.apps.length} app configs`);

  const octokits = config.apps.map((app) => createOctokit(app, config.baseUrl));
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
    (acc, cur) => {
      if (cur.remaining > acc.rateLimit.remaining) {
        return { bestIndex: cur.appIndex, rateLimit: cur };
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
 * Decodes base64-encoded private keys, passes through PEM unchanged.
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
    baseUrl,
    auth: {
      ...appConfig,
      // TODO: this type check can be removed once the issue will be fixed in @octokit/auth-app
      privateKey:
        appConfig.privateKey && typeof appConfig.privateKey === 'string'
          ? decodePrivateKey(appConfig.privateKey)
          : undefined,
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

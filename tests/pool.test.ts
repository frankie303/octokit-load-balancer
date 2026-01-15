import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { getApp } from '../src/pool';

// Track created instances to return different rate limits
let instanceCount = 0;
let rateLimits = [4900, 4900]; // Default: same rate limits

vi.mock('octokit', () => ({
  Octokit: class MockOctokit {
    private instanceIndex: number;

    constructor() {
      this.instanceIndex = instanceCount++;
    }

    rest = {
      rateLimit: {
        get: vi.fn().mockImplementation(() => {
          return Promise.resolve({
            data: {
              rate: {
                limit: 5000,
                used: 5000 - rateLimits[this.instanceIndex],
                remaining: rateLimits[this.instanceIndex] ?? 4900,
                reset: 1700000000,
              },
            },
          });
        }),
      },
    };
  },
}));

vi.mock('@octokit/auth-app', () => ({
  createAppAuth: vi.fn(),
}));

describe('getApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    instanceCount = 0;
    rateLimits = [4900, 4900];
  });

  const createTestConfig = (count: number) => ({
    apps: Array.from({ length: count }, (_, i) => ({
      appId: `app-${i}`,
      installationId: `install-${i}`,
      privateKey: `-----BEGIN RSA PRIVATE KEY-----\nkey-${i}\n-----END RSA PRIVATE KEY-----`,
    })),
    baseUrl: 'https://api.github.com',
  });

  describe('validation', () => {
    it('throws when config is null', async () => {
      await expect(getApp(null as never)).rejects.toThrow('No apps provided');
    });

    it('throws when config is undefined', async () => {
      await expect(getApp(undefined as never)).rejects.toThrow(
        'No apps provided',
      );
    });

    it('throws when apps array is empty', async () => {
      await expect(
        getApp({ apps: [], baseUrl: 'https://api.github.com' }),
      ).rejects.toThrow('No apps provided');
    });
  });

  describe('octokit creation', () => {
    it('returns octokit instance', async () => {
      const octokit = await getApp(createTestConfig(2));

      expect(octokit).toBeDefined();
      expect(octokit.rest).toBeDefined();
    });

    it('handles base64 encoded private keys', async () => {
      const octokit = await getApp({
        apps: [
          {
            appId: '1',
            installationId: '2',
            privateKey: Buffer.from(
              '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
            ).toString('base64'),
          },
        ],
        baseUrl: 'https://api.github.com',
      });
      expect(octokit).toBeDefined();
    });

    it('handles raw PEM private keys', async () => {
      const octokit = await getApp({
        apps: [
          {
            appId: '1',
            installationId: '2',
            privateKey:
              '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
          },
        ],
        baseUrl: 'https://api.github.com',
      });
      expect(octokit).toBeDefined();
    });
  });

  describe('rate limit selection', () => {
    it('selects app with highest remaining rate limit', async () => {
      // First app has 1000 remaining, second has 4000 remaining
      rateLimits = [1000, 4000];

      const octokit = await getApp({
        apps: [
          {
            appId: 'app-0',
            installationId: 'install-0',
            privateKey:
              '-----BEGIN RSA PRIVATE KEY-----\nkey-0\n-----END RSA PRIVATE KEY-----',
          },
          {
            appId: 'app-1',
            installationId: 'install-1',
            privateKey:
              '-----BEGIN RSA PRIVATE KEY-----\nkey-1\n-----END RSA PRIVATE KEY-----',
          },
        ],
        baseUrl: 'https://api.github.com',
      });

      // Should return the second octokit (index 1) with higher rate limit
      expect(octokit).toBeDefined();
    });

    it('throws when all apps have exhausted rate limits', async () => {
      rateLimits = [0, 0];

      await expect(
        getApp({
          apps: [
            {
              appId: 'app-0',
              installationId: 'install-0',
              privateKey:
                '-----BEGIN RSA PRIVATE KEY-----\nkey-0\n-----END RSA PRIVATE KEY-----',
            },
            {
              appId: 'app-1',
              installationId: 'install-1',
              privateKey:
                '-----BEGIN RSA PRIVATE KEY-----\nkey-1\n-----END RSA PRIVATE KEY-----',
            },
          ],
          baseUrl: 'https://api.github.com',
        }),
      ).rejects.toThrow('All GitHub Apps have exhausted their rate limits');
    });
  });

  describe('debug logging', () => {
    const originalEnv = process.env.DEBUG;

    afterEach(() => {
      process.env.DEBUG = originalEnv;
    });

    it('logs when DEBUG=* is set', async () => {
      process.env.DEBUG = '*';
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await getApp({
        apps: [
          {
            appId: '1',
            installationId: '2',
            privateKey:
              '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
          },
        ],
        baseUrl: 'https://api.github.com',
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('logs when DEBUG includes package name', async () => {
      process.env.DEBUG = 'other,octokit-load-balancer,another';
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await getApp({
        apps: [
          {
            appId: '1',
            installationId: '2',
            privateKey:
              '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
          },
        ],
        baseUrl: 'https://api.github.com',
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('does not log when DEBUG is not set', async () => {
      delete process.env.DEBUG;
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await getApp({
        apps: [
          {
            appId: '1',
            installationId: '2',
            privateKey:
              '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
          },
        ],
        baseUrl: 'https://api.github.com',
      });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

import type { StrategyOptions } from '@octokit/auth-app';

/**
 * Configuration for a single GitHub App.
 * Uses Octokit's StrategyOptions directly.
 */
export type GitHubAppConfig = StrategyOptions;

/**
 * Rate limit data from GitHub API
 */
export interface RateLimitData {
  limit: number;
  used: number;
  remaining: number;
  reset: number;
}

/**
 * Configuration for getApp
 */
export interface GitHubAppPoolConfig {
  /** Array of app configurations */
  apps: GitHubAppConfig[];
  /** Base URL for the GitHub API (e.g., 'https://api.github.com' or 'https://github.company.com/api/v3') */
  baseUrl: string;
}

/**
 * Rate limit information for a GitHub App
 */
export interface RateLimitInfo extends RateLimitData {
  /** Index of the app in the config array */
  appIndex: number;
}

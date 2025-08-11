import type {Config} from 'sentry/types/system';

// Skips data preload if the user is on an invitation acceptance page as they might not have access to the data yet, leading to a 403 error.
export function shouldPreloadData(config: Config): boolean {
  if (window.location.pathname.startsWith('/accept/')) {
    return false;
  }

  return config.shouldPreloadData;
}

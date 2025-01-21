import {Release} from '@sentry/release-parser';

export function parseVersion(rawVersion: string): Release | null {
  try {
    const parsedVersion = new Release(rawVersion);
    return parsedVersion;
  } catch {
    return null;
  }
}

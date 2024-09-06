import {Release} from '@sentry/release-parser';

export const isSemverRelease = (rawVersion: string): boolean => {
  try {
    const parsedVersion = new Release(rawVersion);
    return !!parsedVersion.versionParsed;
  } catch {
    return false;
  }
};

import {parseVersion} from 'sentry/utils/versions/parseVersion';

export const isSemverRelease = (rawVersion: string): boolean => {
  const parsedVersion = parseVersion(rawVersion);
  return !!parsedVersion?.versionParsed;
};

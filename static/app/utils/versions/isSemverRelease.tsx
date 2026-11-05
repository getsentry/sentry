import {parseVersion} from './parseVersion';

export const isSemverRelease = (rawVersion: string): boolean => {
  const parsedVersion = parseVersion(rawVersion);
  return !!parsedVersion?.versionParsed;
};

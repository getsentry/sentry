import {Release} from '@sentry/release-parser';

export const formatVersion = (rawVersion: string, withPackage = false) => {
  try {
    const parsedVersion = new Release(rawVersion);
    const versionToDisplay = parsedVersion.describe();

    if (versionToDisplay.length) {
      return `${versionToDisplay}${withPackage && parsedVersion.package ? `, ${parsedVersion.package}` : ''}`;
    }

    return rawVersion;
  } catch {
    return rawVersion;
  }
};

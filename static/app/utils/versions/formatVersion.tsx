import {parseVersion} from './parseVersion';

export const formatVersion = (rawVersion: string, withPackage = false) => {
  const parsedVersion = parseVersion(rawVersion);
  if (!parsedVersion) {
    return rawVersion;
  }

  const versionToDisplay = parsedVersion.describe();

  if (versionToDisplay.length) {
    return `${versionToDisplay}${withPackage && parsedVersion.package ? `, ${parsedVersion.package}` : ''}`;
  }

  return rawVersion;
};

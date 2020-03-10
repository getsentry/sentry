import get from 'lodash/get';
import {Release} from '@sentry/release-parser';

import {t} from 'app/locale';
import {CommitAuthor, User} from 'app/types';

export function userDisplayName(user: User | CommitAuthor, includeEmail = true): string {
  let displayName = String(get(user, 'name', t('Unknown author'))).trim();

  if (displayName.length <= 0) {
    displayName = t('Unknown author');
  }

  const email = String(get(user, 'email', '')).trim();

  if (email.length > 0 && email !== displayName && includeEmail) {
    displayName += ' (' + email + ')';
  }
  return displayName;
}

export const formatVersion = (rawVersion: string, withPackage = false) => {
  try {
    const parsedVersion = new Release(rawVersion);
    const versionToDisplay = parsedVersion.describe();

    if (versionToDisplay.length) {
      return `${versionToDisplay}${
        withPackage && parsedVersion.package ? `, ${parsedVersion.package}` : ''
      }`;
    }

    return rawVersion;
  } catch {
    return rawVersion;
  }
};

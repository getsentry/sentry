import get from 'lodash/get';
import {Release} from '@sentry/release-parser';

import {t, tn} from 'app/locale';
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

function roundWithFixed(
  value: number,
  fixedDigits: number
): {label: string; result: number} {
  const label = value.toFixed(fixedDigits);
  const result = fixedDigits <= 0 ? Math.round(value) : value;

  return {label, result};
}

export function getDuration(
  seconds: number,
  fixedDigits: number = 0,
  abbreviation: boolean = false
): string {
  const value = Math.abs(seconds * 1000);

  if (value >= 604800000) {
    const {label, result} = roundWithFixed(value / 604800000, fixedDigits);
    return `${label} ${abbreviation ? 'wk' : tn('week', 'weeks', result)}`;
  }
  if (value >= 172800000) {
    const {label, result} = roundWithFixed(value / 86400000, fixedDigits);
    return `${label} ${abbreviation ? 'd' : tn('day', 'days', result)}`;
  }
  if (value >= 7200000) {
    const {label, result} = roundWithFixed(value / 3600000, fixedDigits);
    return `${label} ${abbreviation ? 'hr' : tn('hour', 'hours', result)}`;
  }
  if (value >= 120000) {
    const {label, result} = roundWithFixed(value / 60000, fixedDigits);
    return `${label} ${abbreviation ? 'min' : tn('minute', 'minutes', result)}`;
  }
  if (value >= 1000) {
    const {label, result} = roundWithFixed(value / 1000, fixedDigits);
    return `${label} ${abbreviation ? 's' : tn('second', 'seconds', result)}`;
  }

  const {label} = roundWithFixed(value, fixedDigits);

  return `${label}ms`;
}

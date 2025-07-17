import {ELLIPSIS} from 'sentry/utils/string/unicode';
import {formatVersion} from 'sentry/utils/versions/formatVersion';

function centerTruncate(value: string, maxLength = 20) {
  const divider = Math.floor(maxLength / 2);
  if (value?.length > maxLength) {
    return `${value.slice(0, divider)}${ELLIPSIS}${value.slice(value.length - divider)}`;
  }
  return value;
}

export function formatVersionAndCenterTruncate(value: string, maxLength?: number) {
  const formattedVersion = formatVersion(value);
  return centerTruncate(formattedVersion, maxLength);
}

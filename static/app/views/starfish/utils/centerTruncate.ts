import {formatVersion} from 'sentry/utils/formatters';

export function centerTruncate(value: string, maxLength: number = 20) {
  const divider = Math.floor(maxLength / 2);
  if (value?.length > maxLength) {
    return `${value.slice(0, divider)}\u2026${value.slice(value.length - divider)}`;
  }
  return value;
}

export function formatVersionAndCenterTruncate(value: string, maxLength?: number) {
  const formattedVersion = formatVersion(value);
  return centerTruncate(formattedVersion, maxLength);
}

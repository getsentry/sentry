import {ELLIPSIS} from 'sentry/utils/string/unicode';

export default function centerTruncate(value: string, maxLength = 20) {
  const divider = Math.floor(maxLength / 2);
  if (value?.length > maxLength) {
    return `${value.slice(0, divider)}${ELLIPSIS}${value.slice(value.length - divider)}`;
  }
  return value;
}

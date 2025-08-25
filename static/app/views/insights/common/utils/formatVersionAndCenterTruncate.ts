import centerTruncate from 'sentry/utils/string/centerTruncate';
import {formatVersion} from 'sentry/utils/versions/formatVersion';

export function formatVersionAndCenterTruncate(value: string, maxLength?: number) {
  const formattedVersion = formatVersion(value);
  return centerTruncate(formattedVersion, maxLength);
}

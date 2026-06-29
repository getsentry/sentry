import {getUtcDateString} from 'sentry/utils/dates';

export function createLogDownloadFilename(base: string, format: string) {
  const now = new Date();
  return `${base} ${getUtcDateString(now)}.${format}`;
}

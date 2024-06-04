import type {DateString} from 'sentry/types/core';

export function statsPeriodToDays(
  statsPeriod?: string | null,
  start?: DateString,
  end?: DateString
) {
  if (statsPeriod?.endsWith('d')) {
    return parseInt(statsPeriod.slice(0, -1), 10);
  }
  if (statsPeriod?.endsWith('h')) {
    return parseInt(statsPeriod.slice(0, -1), 10) / 24;
  }
  if (start && end) {
    return (new Date(end).getTime() - new Date(start).getTime()) / (24 * 60 * 60 * 1000);
  }
  return 0;
}

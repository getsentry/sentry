import cronstrue from 'cronstrue';

import {shouldUse24Hours} from 'sentry/utils/dates';

export function crontabAsText(crontabInput: string | null): string | null {
  if (!crontabInput) {
    return null;
  }
  let parsedSchedule: string;
  try {
    parsedSchedule = cronstrue.toString(crontabInput, {
      verbose: true,
      use24HourTimeFormat: shouldUse24Hours(),
    });
  } catch (_e) {
    return null;
  }

  return parsedSchedule;
}

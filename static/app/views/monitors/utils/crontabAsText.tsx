import cronstrue from 'cronstrue';

import {shouldUse24Hours} from 'sentry/utils/dates';

/**
 * Display a human readible label of a crontab expression
 */
export function crontabAsText(crontabInput: string | null): string | null {
  if (!crontabInput) {
    return null;
  }
  let parsedSchedule: string;
  try {
    parsedSchedule = cronstrue.toString(crontabInput, {
      verbose: false,
      use24HourTimeFormat: shouldUse24Hours(),
    });
  } catch (_e) {
    return null;
  }

  return parsedSchedule;
}

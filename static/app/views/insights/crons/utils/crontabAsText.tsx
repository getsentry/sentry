import cronstrue from 'cronstrue';

import {shouldUse24Hours} from 'sentry/utils/dates';

/**
 * Display a human readible label of a crontab expression
 */
export function crontabAsText(crontabInput: string | null): string | null {
  if (!crontabInput) {
    return null;
  }

  // The backend does not support "no specific value" markers or the "weekday"
  // markers (from the Java quarts job scheduler). Do not parse these to avoid confusion
  if (['?', 'W'].some(marker => crontabInput.includes(marker))) {
    return null;
  }

  // The backend does not support expressions with more than 5 fields. Do not
  // parse these to avoid confusion
  if (crontabInput.split(' ').length > 5) {
    return null;
  }

  try {
    return cronstrue.toString(crontabInput, {
      verbose: false,
      use24HourTimeFormat: shouldUse24Hours(),
    });
  } catch (_e) {
    return null;
  }
}

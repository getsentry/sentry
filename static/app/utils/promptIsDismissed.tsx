import moment from 'moment-timezone';

import type {PromptData} from 'sentry/actionCreators/prompts';

/**
 * Given a snoozed unix timestamp in seconds, returns the number of days since
 * the prompt was snoozed.
 *
 * @param snoozedTs Snoozed timestamp
 */
function snoozedDays(snoozedTs: number) {
  const now = moment.utc();
  const snoozedOn = moment.unix(snoozedTs).utc();
  return now.diff(snoozedOn, 'days');
}

export const DEFAULT_SNOOZE_PROMPT_DAYS = 14;
export const promptIsDismissed = (
  prompt: PromptData,
  daysToSnooze: number = DEFAULT_SNOOZE_PROMPT_DAYS
): boolean => {
  if (typeof prompt?.dismissedTime === 'number') {
    return true;
  }

  if (typeof prompt?.snoozedTime === 'number') {
    return snoozedDays(prompt.snoozedTime) < daysToSnooze;
  }

  return false;
};

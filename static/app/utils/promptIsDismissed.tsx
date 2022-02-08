import {PromptData} from 'sentry/actionCreators/prompts';

import {snoozedDays} from './promptsActivity';

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

export function promptCanShow(prompt: string, uuid: string): boolean {
  /**
   * This is to ensure that only one of suspect_commits
   * or distributed_tracing is shown at a given time.
   */
  const x = (parseInt(uuid.charAt(0), 16) || 0) % 2;
  if (prompt === 'suspect_commits') {
    return x === 1;
  }
  if (prompt === 'distributed_tracing') {
    return x === 0;
  }
  return true;
}

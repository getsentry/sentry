import {PromptData} from 'app/actionCreators/prompts';

import {snoozedDays} from './promptsActivity';

export const promptIsDismissed = (prompt: PromptData, daysToSnooze: number = 14) => {
  const {snoozedTime, dismissedTime} = prompt || {};
  // check if the prompt has been dismissed
  if (dismissedTime) {
    return true;
  }
  // check if it has been snoozed
  return !snoozedTime ? false : snoozedDays(snoozedTime) < daysToSnooze;
};

export function promptCanShow(prompt: string, uuid: string): boolean {
  /**
   * This is to ensure that only one of suspect_commits
   * or distributed_tracing is shown at a given time.
   */
  const x = (parseInt(uuid.charAt(0), 16) || 0) % 2;
  if (prompt === 'suspect_commits') {
    return x === 1;
  } else if (prompt === 'distributed_tracing') {
    return x === 0;
  } else {
    return true;
  }
}

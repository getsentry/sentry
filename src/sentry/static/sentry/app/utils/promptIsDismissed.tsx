import {PromptData} from 'app/actionCreators/prompts';

import {snoozedDays} from './promptsActivity';

export const promptIsDismissed = (prompt: PromptData, daysToSnooze: number = 14) => {
  const {snoozedTime, dismissedTime} = prompt || {};
  // check if the prompt has been dismissed
  if (dismissedTime) {
    return true;
  }
  //check if it has been snoozed
  return !snoozedTime ? false : snoozedDays(snoozedTime) < daysToSnooze;
};

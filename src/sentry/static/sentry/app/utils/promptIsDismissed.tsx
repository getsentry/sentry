import {PromptData} from 'app/actionCreators/prompts';

import {snoozedDays} from './promptsActivity';

export const promptIsDismissed = (prompt: PromptData, daysToSnooze?: number) => {
  if (typeof daysToSnooze === 'undefined') {
    daysToSnooze = 14;
  }
  return !prompt?.snoozedTime ? false : snoozedDays(prompt?.snoozedTime) < daysToSnooze;
};

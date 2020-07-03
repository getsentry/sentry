import {OnboardingTask} from 'app/types';

export const taskIsDone = (task: OnboardingTask) =>
  ['complete', 'skipped'].includes(task.status);

export const findCompleteTasks = (task: OnboardingTask) =>
  task.completionSeen && ['complete', 'skipped'].includes(task.status);

export const findActiveTasks = (task: OnboardingTask) =>
  task.requisiteTasks.length === 0 && !findCompleteTasks(task);

export const findUpcomingTasks = (task: OnboardingTask) =>
  task.requisiteTasks.length > 0 && !findCompleteTasks(task);

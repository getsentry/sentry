import type {OnboardingTask} from 'sentry/types/onboarding';

export const taskIsDone = (task: OnboardingTask) =>
  ['complete', 'skipped'].includes(task.status);

export const findCompleteTasks = (task: OnboardingTask) =>
  task.completionSeen && ['complete', 'skipped'].includes(task.status);

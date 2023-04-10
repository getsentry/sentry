import {OnboardingTaskStatus} from 'sentry/types';

export const isDone = (task: OnboardingTaskStatus) =>
  task.status === 'complete' || task.status === 'skipped';

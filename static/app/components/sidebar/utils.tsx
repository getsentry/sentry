import {OnboardingTaskStatus} from 'sentry/types';

export const isDone = (task: OnboardingTaskStatus) =>
  task.status === 'complete' || task.status === 'skipped';

// To be passed as the `source` parameter in router navigation state
// e.g. {pathname: '/issues/', state: {source: `sidebar`}}
export const SIDEBAR_NAVIGATION_SOURCE = 'sidebar';

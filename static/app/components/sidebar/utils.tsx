import type {OnboardingTaskStatus} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';

export const isDone = (task: OnboardingTaskStatus) =>
  task.status === 'complete' || task.status === 'skipped';

// To be passed as the `source` parameter in router navigation state
// e.g. {pathname: '/issues/', state: {source: `sidebar`}}
export const SIDEBAR_NAVIGATION_SOURCE = 'sidebar';

export function hasWhatIsNewRevampFeature(organization: Organization) {
  return organization.features.includes('what-is-new-revamp');
}

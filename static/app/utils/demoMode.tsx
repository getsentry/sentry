import ConfigStore from 'sentry/stores/configStore';
import {OnboardingTaskKey} from 'sentry/types';

export function extraQueryParameter(): URLSearchParams {
  const extraQueryString = window.SandboxData?.extraQueryString || '';
  const extraQuery = new URLSearchParams(extraQueryString);
  return extraQuery;
}

export function extraQueryParameterWithEmail(): URLSearchParams {
  const params = extraQueryParameter();
  const email = localStorage.getItem('email');
  if (email) {
    params.append('email', email);
  }
  return params;
}

export function urlAttachQueryParams(url: string, params: URLSearchParams): string {
  const queryString = params.toString();
  if (queryString) {
    return url + '?' + queryString;
  }
  return url;
}

// For the Sandbox, we are testing a new walkthrough. This affects a few different components of Sentry including the Onboarding Sidebar, Onboarding Tasks, the Demo End Modal, Demo Sign Up Modal, Guides, and more.
// Outside of the Sandbox, this should have no effect on other elements of Sentry.
export function isDemoWalkthrough(): boolean {
  return ConfigStore.get('demoMode');
}

// Function to determine which tour has completed depending on the guide that is being passed in.
export function getTourTask(
  guide: string
): {task: OnboardingTaskKey; tour: string} | undefined {
  switch (guide) {
    case 'sidebar_v2':
      return {tour: 'tabs', task: OnboardingTaskKey.SIDEBAR_GUIDE};
    case 'issues_v3':
      return {tour: 'issues', task: OnboardingTaskKey.ISSUE_GUIDE};
    case 'release-details_v2':
      return {tour: 'releases', task: OnboardingTaskKey.RELEASE_GUIDE};
    case 'transaction_details_v2':
      return {tour: 'performance', task: OnboardingTaskKey.PERFORMANCE_GUIDE};
    default:
      return undefined;
  }
}

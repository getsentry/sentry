import {setForceHide} from 'sentry/actionCreators/guides';
import ConfigStore from 'sentry/stores/configStore';
import {OnboardingTaskKey} from 'sentry/types/onboarding';

import {demoEmailModal, demoSignupModal} from '../../actionCreators/modal';

const SIGN_UP_MODAL_DELAY = 20_000;

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

export function isDemoModeEnabled(): boolean {
  return ConfigStore.get('demoMode');
}

export function openDemoSignupModal() {
  if (!isDemoModeEnabled()) {
    return;
  }

  setTimeout(() => {
    demoSignupModal();
  }, SIGN_UP_MODAL_DELAY);
}

export function openDemoEmailModal() {
  if (!isDemoModeEnabled()) {
    return;
  }

  // email already added
  if (localStorage.getItem('sandbox_email_added') === '1') {
    return;
  }

  demoEmailModal({onAddedEmail, onFailure: handleFailure});
}

function onAddedEmail(email) {
  setForceHide(false);
  localStorage.setItem('email', email);
  localStorage.setItem(
    'time_entered',
    JSON.stringify(Math.floor(new Date().getTime() / 1000))
  );
  localStorage.setItem('sandbox_email_added', '1');
}

function handleFailure() {
  setForceHide(false);
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

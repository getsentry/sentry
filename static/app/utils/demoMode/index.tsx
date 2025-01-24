import {setForceHide} from 'sentry/actionCreators/guides';
import ConfigStore from 'sentry/stores/configStore';
import {OnboardingTaskKey, type OnboardingTaskStatus} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';

import {demoEmailModal, demoSignupModal} from '../../actionCreators/modal';

const SIGN_UP_MODAL_DELAY = 30_000;

const DEMO_MODE_EMAIL_KEY = 'demo-mode:email';

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
  if (localStorage.getItem(DEMO_MODE_EMAIL_KEY)) {
    return;
  }

  demoEmailModal({
    onAddedEmail,
    onFailure: () => {
      setForceHide(false);
    },
  });
}

function onAddedEmail(email: string) {
  setForceHide(false);
  localStorage.setItem(DEMO_MODE_EMAIL_KEY, email);
  openDemoSignupModal();
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

export function getDemoGuides() {
  return [
    {guide: 'sidebar_v2', seen: false},
    {guide: 'issues_v3', seen: false},
    {guide: 'releases_v2', seen: false},
    {guide: 'react-native-release', seen: false},
    {guide: 'release-details_v2', seen: false},
    {guide: 'performance', seen: false},
    {guide: 'transaction_summary', seen: false},
    {guide: 'transaction_details_v2', seen: false},
    {guide: 'issue_stream_v3', seen: false},
  ];
}

let onboardingTasks: OnboardingTaskStatus[] = [];

export function getDemoOnboardingTasks(
  organization: Organization
): OnboardingTaskStatus[] {
  if (!onboardingTasks.length) {
    onboardingTasks = organization.onboardingTasks;
  }
  return onboardingTasks;
}

export function updateDemoOnboardingTask(updatedTask: any) {
  const hasExistingTask = onboardingTasks.find(task => task.task === updatedTask.task);

  const user = ConfigStore.get('user');
  onboardingTasks = hasExistingTask
    ? onboardingTasks.map(task =>
        task.task === updatedTask.task ? {...task, ...updatedTask} : task
      )
    : [...onboardingTasks, {...updatedTask, user} as OnboardingTaskStatus];
}

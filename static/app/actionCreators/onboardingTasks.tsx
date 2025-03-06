import type {Client} from 'sentry/api';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import type {OnboardingTaskStatus, UpdatedTask} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import {updateDemoWalkthroughTask} from 'sentry/utils/demoMode/guides';

/**
 * Update an onboarding task.
 *
 * If no API client is provided the task will not be updated on the server side
 * and will only update in the organization store.
 */
export function updateOnboardingTask(
  api: Client | null,
  organization: Organization,
  updatedTask: UpdatedTask
) {
  if (isDemoModeEnabled()) {
    updateDemoWalkthroughTask(updatedTask);
    return;
  }
  if (api !== null) {
    api.requestPromise(`/organizations/${organization.slug}/onboarding-tasks/`, {
      method: 'POST',
      data: updatedTask,
    });
  }

  const hasExistingTask = organization.onboardingTasks.find(
    task => task.task === updatedTask.task
  );

  const user = ConfigStore.get('user');
  const onboardingTasks = hasExistingTask
    ? organization.onboardingTasks.map(task =>
        task.task === updatedTask.task ? {...task, ...updatedTask} : task
      )
    : [...organization.onboardingTasks, {...updatedTask, user} as OnboardingTaskStatus];

  OrganizationStore.onUpdate({onboardingTasks});
}

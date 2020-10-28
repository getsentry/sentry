import {Client} from 'app/api';
import {Organization, OnboardingTask} from 'app/types';
import OrganizationActions from 'app/actions/organizationActions';
import ConfigStore from 'app/stores/configStore';

/**
 * Update an onboarding task.
 *
 * If no API client is provided the task will not be updated on the server side
 * and will only update in the organization store.
 */
export async function updateOnboardingTask(
  api: Client | null,
  organization: Organization,
  updatedTask: Partial<Pick<OnboardingTask, 'status' | 'data'>> & {
    task: OnboardingTask['task'];
    /**
     * Marks completion seen. This differs from the OnboardingTask
     * completionSeen type as that returns the date completion was seen.
     */
    completionSeen?: boolean;
  }
) {
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
    : [...organization.onboardingTasks, {...updatedTask, user}];

  OrganizationActions.update({onboardingTasks});
}

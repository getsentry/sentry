import OrganizationStore from 'sentry/stores/organizationStore';
import type {UpdatedTask} from 'sentry/types/onboarding';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

/**
 * Custom hook to update multiple onboarding tasks in parallel.
 */
export function useMutateOnboardingTasks() {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();

  return useMutation({
    mutationFn: async (tasksToUpdate: UpdatedTask[]) => {
      await Promise.all(
        tasksToUpdate.map(task =>
          api.requestPromise(`/organizations/${organization.slug}/onboarding-tasks/`, {
            method: 'POST',
            data: task,
          })
        )
      );
      return tasksToUpdate;
    },
    onSuccess: (tasksToUpdate: UpdatedTask[]) => {
      const updatedOnboardingTasks = organization.onboardingTasks.map(task => {
        const updatedTask = tasksToUpdate.find(updated => updated.task === task.task);
        return updatedTask ? {...task, ...updatedTask} : task;
      });

      OrganizationStore.onUpdate({
        onboardingTasks: updatedOnboardingTasks,
      });
    },
  });
}

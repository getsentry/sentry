import {findCompleteTasks, taskIsDone} from 'sentry/components/onboardingWizard/utils';
import {
  type OnboardingTask,
  OnboardingTaskGroup,
  type OnboardingTaskStatus,
} from 'sentry/types/onboarding';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

// Merge supported onboarding tasks with their completion status from the server.
function mergeTasks({
  supportedTasks,
  serverTasks,
}: {
  serverTasks: OnboardingTaskStatus[];
  supportedTasks: OnboardingTask[];
}): OnboardingTask[] {
  return supportedTasks.map(
    supportedTask =>
      ({
        ...supportedTask,
        ...serverTasks.find(
          serverTask =>
            serverTask.task === supportedTask.task ||
            serverTask.task === supportedTask.serverTask
        ),
      }) as OnboardingTask
  );
}

// This hook polls the onboarding tasks endpoint every second until all supported tasks are complete and
// returns the task groups: "allTasks", "gettingStartedTasks", "beyondBasicsTasks", and "completeTasks".
export function useOnboardingTasks({
  supportedTasks,
  enabled,
}: {
  enabled: boolean;
  supportedTasks: OnboardingTask[];
}): {
  allTasks: OnboardingTask[];
  beyondBasicsTasks: OnboardingTask[];
  completeTasks: OnboardingTask[];
  doneTasks: OnboardingTask[];
  gettingStartedTasks: OnboardingTask[];
  refetch: () => void;
} {
  const organization = useOrganization();

  const {data: serverTasks = {onboardingTasks: []}, refetch} = useApiQuery<{
    onboardingTasks: OnboardingTaskStatus[];
  }>([`/organizations/${organization.slug}/onboarding-tasks/`], {
    staleTime: 0,
    enabled,
    refetchInterval: query => {
      const data = query.state.data?.[0]?.onboardingTasks;
      if (!data) {
        return false;
      }

      const serverCompletedTasks = (data as OnboardingTask[]).filter(findCompleteTasks);

      // Stop polling if all tasks are complete
      return serverCompletedTasks.length === supportedTasks.length ? false : 1000; // 1s
    },
  });

  const mergedTasks = mergeTasks({
    supportedTasks,
    serverTasks: serverTasks.onboardingTasks,
  });

  return {
    allTasks: mergedTasks,
    completeTasks: mergedTasks.filter(findCompleteTasks),
    doneTasks: mergedTasks.filter(taskIsDone),
    gettingStartedTasks: mergedTasks.filter(
      task => task.group === OnboardingTaskGroup.GETTING_STARTED
    ),
    beyondBasicsTasks: mergedTasks.filter(
      task => task.group !== OnboardingTaskGroup.GETTING_STARTED
    ),
    refetch,
  };
}

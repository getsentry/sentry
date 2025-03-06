import {useEffect, useMemo, useRef} from 'react';

import {updateOnboardingTask} from 'sentry/actionCreators/onboardingTasks';
import type {OnboardingTask} from 'sentry/types/onboarding';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

function isTaskOverdue2Weeks(dateCompleted: string): boolean {
  const now = new Date();
  const timeDifference = now.getTime() - new Date(dateCompleted).getTime();
  return timeDifference > 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds
}

export function useOverdueDoneTasks({
  doneTasks,
  allTasks,
}: {
  allTasks: OnboardingTask[];
  doneTasks: OnboardingTask[];
}): {
  overdueTasks: OnboardingTask[];
} {
  const api = useApi();
  const organization = useOrganization();

  // Tasks marked as "done" but not completed (user hasn't seen the completion),
  // and the date completed is equal or more than 14 days ago (overdue).
  const overdueTasks = useMemo(() => {
    // Only update 'completionSeen' if the WHOLE onboarding was 'done' but not completed
    // because users haven't seen the 'done' tasks after 14+ days.
    if (allTasks.length === doneTasks.length) {
      return doneTasks.filter(
        task =>
          task.dateCompleted &&
          !task.completionSeen &&
          isTaskOverdue2Weeks(task.dateCompleted)
      );
    }
    return [];
  }, [doneTasks, allTasks]);

  const safeDependencies = useRef({overdueTasks, organization});

  useEffect(() => {
    safeDependencies.current = {overdueTasks, organization};
  });

  useEffect(() => {
    if (!safeDependencies.current.overdueTasks.length) {
      return;
    }

    // Mark overdue tasks as seen, so we can try to mark the onboarding as complete.
    for (const overdueTask of safeDependencies.current.overdueTasks) {
      updateOnboardingTask(api, safeDependencies.current.organization, {
        task: overdueTask.task,
        completionSeen: true,
      });
    }
  }, [api]);

  return {overdueTasks};
}

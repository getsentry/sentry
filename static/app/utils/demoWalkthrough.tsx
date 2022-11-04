import {useEffect, useState} from 'react';

import {getOnboardingTasks} from 'sentry/components/onboardingWizard/taskConfig';
import {
  findActiveTasks,
  findCompleteTasks,
  findUpcomingTasks,
} from 'sentry/components/onboardingWizard/utils';
import {OnboardingTask, Organization, Project} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import {OnboardingState} from 'sentry/views/onboarding/types';

type Options = {
  onboardingState: OnboardingState | undefined;
  organization: Organization;
  projects: Project[];
};

/**
 * This function is used to determine which tasks to show as complete/incomplete in the sidebar progress circle.
 *
 * TODO: Move these to the demo repo once we can use React Hooks in Hooks in the repo.
 *
 */
export function useSandboxSidebarTasks({
  organization,
  projects,
  onboardingState,
}: Options) {
  const api = useApi();

  const [tasks, setTasks] = useState<OnboardingTask[]>([]);

  useEffect(() => {
    const getTasks = async () => {
      const serverTasks = await api.requestPromise(
        `/organizations/${organization.slug}/onboarding-tasks/`,
        {method: 'GET'}
      );

      const taskDescriptors = getOnboardingTasks({
        organization,
        projects,
        onboardingState,
      });
      // Map server task state (i.e. completed status) with tasks objects
      const allTasks = taskDescriptors.map(
        desc =>
          ({
            ...desc,
            ...serverTasks.find(
              serverTask =>
                serverTask.task === desc.task || serverTask.task === desc.serverTask
            ),
            requisiteTasks: [],
          } as OnboardingTask)
      );

      // Map incomplete requisiteTasks as full task objects
      const mappedTasks = allTasks.map(task => ({
        ...task,
        requisiteTasks: task.requisites
          .map(key => allTasks.find(task2 => task2.task === key)!)
          .filter(reqTask => reqTask.status !== 'complete'),
      }));

      setTasks(mappedTasks);
      return;
    };
    getTasks();
  }, [organization, projects, onboardingState, api]);

  return tasks;
}

/**
 * This function is used to determine which onboarding task is shown in the Sidebar panel in the Sandbox.
 *
 * TODO: Move this to the demo repo once we can use React Hooks in Hooks in the repo.
 *
 */
export function useSandboxTasks({organization, projects, onboardingState}: Options) {
  const api = useApi();

  const [allTasks, setAllTasks] = useState<OnboardingTask[]>([]);
  const [customTasks, setCustomTasks] = useState<OnboardingTask[]>([]);
  const [activeTasks, setActiveTasks] = useState<OnboardingTask[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<OnboardingTask[]>([]);
  const [completeTasks, setCompleteTasks] = useState<OnboardingTask[]>([]);

  useEffect(() => {
    const getTasks = async () => {
      const serverTasks = await api.requestPromise(
        `/organizations/${organization.slug}/onboarding-tasks/`,
        {method: 'GET'}
      );

      const taskDescriptors = getOnboardingTasks({
        organization,
        projects,
        onboardingState,
      });
      // Map server task state (i.e. completed status) with tasks objects
      const totalTasks = taskDescriptors.map(
        desc =>
          ({
            ...desc,
            ...serverTasks.find(
              serverTask =>
                serverTask.task === desc.task || serverTask.task === desc.serverTask
            ),
            requisiteTasks: [],
          } as OnboardingTask)
      );

      // Map incomplete requisiteTasks as full task objects
      const mappedTasks = totalTasks.map(task => ({
        ...task,
        requisiteTasks: task.requisites
          .map(key => totalTasks.find(task2 => task2.task === key)!)
          .filter(reqTask => reqTask.status !== 'complete'),
      }));

      const all = mappedTasks.filter(task => task.display);
      const tasks = all.filter(task => !task.renderCard);

      setAllTasks(all);
      setCustomTasks(all.filter(task => task.renderCard));
      setActiveTasks(tasks.filter(findActiveTasks));
      setUpcomingTasks(tasks.filter(findUpcomingTasks));
      setCompleteTasks(tasks.filter(findCompleteTasks));
      return;
    };
    getTasks();
  }, [organization, projects, onboardingState, api]);

  return {
    allTasks,
    customTasks,
    active: activeTasks,
    upcoming: upcomingTasks,
    complete: completeTasks,
  };
}

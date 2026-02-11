import type {GuidesContent} from 'sentry/components/assistant/types';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {
  OnboardingTaskKey,
  type OnboardingTaskStatus,
  type UpdatedTask,
} from 'sentry/types/onboarding';

const DEMO_MODE_WALKTHROUGH_TASKS_KEY = 'demo-mode:walkthrough-tasks';

function getWalkthroughTasks(): OnboardingTaskStatus[] {
  return JSON.parse(localStorage.getItem(DEMO_MODE_WALKTHROUGH_TASKS_KEY) ?? '[]');
}

function saveWalkthroughTasks(tasks: OnboardingTaskStatus[]) {
  localStorage.setItem(DEMO_MODE_WALKTHROUGH_TASKS_KEY, JSON.stringify(tasks));
}

export function getDemoWalkthroughTasks(): OnboardingTaskStatus[] {
  const walkthroughTasks = getWalkthroughTasks();

  if (!walkthroughTasks.length) {
    return [];
  }

  return walkthroughTasks;
}

export function updateDemoWalkthroughTask(updatedTask: UpdatedTask) {
  const walkthroughTasks = getWalkthroughTasks();

  const hasExistingTask = walkthroughTasks.find(task => task.task === updatedTask.task);

  const user = ConfigStore.get('user');
  const updatedWalkthroughTasks = hasExistingTask
    ? walkthroughTasks.map(task =>
        task.task === updatedTask.task ? {...task, ...updatedTask} : task
      )
    : [...walkthroughTasks, {...updatedTask, user} as OnboardingTaskStatus];

  saveWalkthroughTasks(updatedWalkthroughTasks);
}

// Function to determine which tour has completed depending on the guide that is being passed in.
export function getTourTask(
  guide: string
): {task: OnboardingTaskKey; tour: string} | undefined {
  switch (guide) {
    case 'sidebar':
      return {tour: 'tabs', task: OnboardingTaskKey.SIDEBAR_GUIDE};
    case 'sidebar_v2':
      return {tour: 'tabs', task: OnboardingTaskKey.SIDEBAR_GUIDE};
    case 'issues':
      return {tour: 'issues', task: OnboardingTaskKey.ISSUE_GUIDE};
    case 'releases':
      return {tour: 'releases', task: OnboardingTaskKey.RELEASE_GUIDE};
    case 'performance':
      return {tour: 'performance', task: OnboardingTaskKey.PERFORMANCE_GUIDE};

    default:
      return undefined;
  }
}

export function getDemoGuides() {
  return [{guide: 'sidebar_v2', seen: false}];
}

export function getDemoModeGuides(): GuidesContent {
  return [
    {
      guide: 'sidebar_v2',
      requiredTargets: ['projects'],
      priority: 1,
      markOthersAsSeen: true,
      steps: [
        {
          title: t('Projects'),
          target: 'projects',
          description: t(
            `Create a project for any type of application you want to monitor.`
          ),
        },
        {
          title: t('Issues'),
          target: 'issues',
          description: t(
            `Here's a list of what's broken and slow. Sentry automatically groups similar events together into an issue.`
          ),
        },
        {
          title: t('Performance'),
          target: 'performance',
          description: t(
            `Keep a pulse on crash rates, throughput, and latency issues across projects.`
          ),
        },
        {
          title: t('Releases'),
          target: 'releases',
          description: t(
            `Track the health of every release, see differences between releases from crash analytics to adoption rates.`
          ),
        },
        {
          title: t('Discover'),
          target: 'discover',
          description: t(
            `Query and unlock insights into the health of your entire system and get answers to critical business questions all in one place.`
          ),
          nextText: t('Got it'),
        },
      ],
    },
  ];
}

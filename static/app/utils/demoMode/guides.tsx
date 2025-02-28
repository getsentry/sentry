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
    {guide: 'react-release', seen: false},
    {guide: 'release-details_v2', seen: false},
    {guide: 'performance', seen: false},
    {guide: 'transaction_summary', seen: false},
    {guide: 'transaction_details_v2', seen: false},
    {guide: 'issue_stream_v3', seen: false},
  ];
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
    {
      guide: 'issue_stream_v3',
      requiredTargets: ['issue_stream'],
      steps: [
        {
          title: t('Issues'),
          target: 'issue_stream',
          description: t(
            `Sentry automatically groups similar events together into an issue. Similarity is
            determined by stack trace and other factors. Click on an issue to learn more.`
          ),
        },
      ],
    },
    {
      guide: 'issues_v3',
      requiredTargets: ['tags'],
      steps: [
        {
          title: t('Metadata and metrics'),
          target: 'tags',
          description: t(
            `See tags like specific users affected by the event, device, OS, and browser type.
            On the right side of the page you can view the number of affected users and exception frequency overtime.`
          ),
        },
        {
          title: t('Find your broken code'),
          target: 'stacktrace',
          description: t(
            `View the stack trace to see the exact sequence of function calls leading to the error in question.`
          ),
        },
        {
          title: t('Retrace your steps'),
          target: 'breadcrumbs',
          description: t(
            `Sentry automatically captures breadcrumbs for events so you can see the sequence of events leading up to the error.`
          ),
          nextText: t('Got it'),
        },
      ],
    },
    {
      guide: 'releases_v2',
      requiredTargets: ['release_projects'],
      priority: 1,
      steps: [
        {
          title: t('Compare releases'),
          target: 'release_projects',
          description: t(
            `Click here and select the "react" project to see how the release is trending compared to previous releases.`
          ),
        },
      ],
    },
    {
      guide: 'react-release',
      requiredTargets: ['release_version'],
      steps: [
        {
          title: t('Release-specific trends'),
          target: 'release_version',
          description: t(
            `Select the latest release to review new and regressed issues, and business critical metrics like crash rate, and user adoption.`
          ),
        },
      ],
    },
    {
      guide: 'release-details_v2',
      requiredTargets: ['release_states'],
      steps: [
        {
          title: t('New and regressed issues'),
          target: 'release_states',
          description: t(
            `Along with reviewing how your release is trending over time compared to previous releases, you can view new and regressed issues here.`
          ),
        },
      ],
    },
    {
      guide: 'performance',
      requiredTargets: ['performance_table'],
      steps: [
        {
          title: t('See slow transactions'),
          target: 'performance_table',
          description: t(
            `Trace slow-loading pages back to their API calls, as well as, related errors and users impacted across projects. Select a transaction to see more details.`
          ),
        },
      ],
    },
    {
      guide: 'transaction_summary',
      requiredTargets: ['user_misery', 'transactions_table'],
      steps: [
        {
          title: t('Identify the root cause'),
          target: 'user_misery',
          description: t(
            'Dive into the details behind a slow transaction. See User Misery, Apdex, and more metrics, along with related events and suspect spans.'
          ),
        },
        {
          title: t('Breakdown event spans'),
          target: 'transactions_table',
          description: t(
            'Select an Event ID from a list of slow transactions to uncover slow spans.'
          ),
          nextText: t('Got it'),
        },
      ],
    },
    {
      guide: 'transaction_details_v2',
      requiredTargets: ['span_tree'],
      steps: [
        {
          title: t('See slow fast'),
          target: 'span_tree',
          description: t(
            `Expand the spans to see span details from start date, end date to the operation. Below you can view breadcrumbs for a play-by-play of what your users
            did before encountering the performance issue.`
          ),
        },
      ],
    },
  ];
}

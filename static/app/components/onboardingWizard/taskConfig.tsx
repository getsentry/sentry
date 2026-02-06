import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import {filterSupportedTasks} from 'sentry/components/onboardingWizard/filterSupportedTasks';
import {filterProjects} from 'sentry/components/performanceOnboarding/utils';
import {sourceMaps} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import OnboardingDrawerStore, {
  OnboardingDrawerKey,
} from 'sentry/stores/onboardingDrawerStore';
import type {OnboardingTask, OnboardingTaskDescriptor} from 'sentry/types/onboarding';
import {OnboardingTaskGroup, OnboardingTaskKey} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {getDemoWalkthroughTasks} from 'sentry/utils/demoMode/guides';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {getPerformanceBaseUrl} from 'sentry/views/performance/utils';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

function hasPlatformWithSourceMaps(projects: Project[] | undefined) {
  return projects === undefined
    ? false
    : projects.some(({platform}) => platform && sourceMaps.includes(platform));
}

type Options = {
  /**
   * The organization to show onboarding tasks for
   */
  organization: Organization;
  /**
   * A list of the organizations projects. This is used for some onboarding
   * tasks to show additional task details (such as for suggesting sourcemaps)
   */
  projects?: Project[];
};

function getIssueAlertUrl({projects, organization}: Options) {
  if (!projects?.length) {
    return makeAlertsPathname({
      path: '/rules/',
      organization,
    });
  }
  // pick the first project with events if we have that, otherwise just pick the first project
  const firstProjectWithEvents = projects.find(project => !!project.firstEvent);
  const project = firstProjectWithEvents ?? projects[0]!;
  return makeAlertsPathname({
    path: `/${project.slug}/wizard/`,
    organization,
  });
}

function getOnboardingInstructionsUrl({projects, organization}: Options) {
  // This shall never be the case, since this is step is locked until a project is created,
  // but if the user falls into this case for some reason,
  // he needs to select the platform again since it is not available as a parameter here
  if (!projects?.length) {
    return makeProjectsPathname({
      path: `/:projectId/getting-started/`,
      organization,
    });
  }

  const allProjectsWithoutErrors = projects.every(project => !project.firstEvent);
  // If all created projects don't have any errors,
  // we ask the user to pick a project before navigating to the instructions
  if (allProjectsWithoutErrors) {
    return makeProjectsPathname({
      path: `/:projectId/getting-started/`,
      organization,
    });
  }

  // Pick the first project without an error
  const firstProjectWithoutError = projects.find(project => !project.firstEvent);
  // If all projects contain errors, this step will not be visible to the user,
  // but if the user falls into this case for some reason, we pick the first project
  const project = firstProjectWithoutError ?? projects[0]!;

  return makeProjectsPathname({
    path: `/${project.slug}/getting-started/`,
    organization,
  });
}

export function getOnboardingTasks({
  organization,
  projects,
}: Options): OnboardingTaskDescriptor[] {
  const performanceUrl = `${getPerformanceBaseUrl(organization.slug, 'frontend')}/`;

  if (isDemoModeActive()) {
    return [
      {
        task: OnboardingTaskKey.ISSUE_GUIDE,
        title: t('Issues'),
        description: t(
          'Here’s a list of errors and performance problems. And everything you need to know to fix it.'
        ),
        skippable: false,
        actionType: 'app',
        location: `/organizations/${organization.slug}/issues/`,
        display: true,
        group: OnboardingTaskGroup.GETTING_STARTED,
      },
      {
        task: OnboardingTaskKey.SIDEBAR_GUIDE,
        title: t('Check out the different tabs'),
        description: t('Press the start button for a guided tour through each tab.'),
        skippable: false,
        actionType: 'app',
        location: makeProjectsPathname({path: '/', organization}),
        display: true,
        group: OnboardingTaskGroup.GETTING_STARTED,
      },
      {
        task: OnboardingTaskKey.PERFORMANCE_GUIDE,
        title: t('Performance'),
        description: t(
          'See slow fast. Trace slow-loading pages back to their API calls as well as all related errors'
        ),
        skippable: false,
        actionType: 'app',
        location: performanceUrl,
        display: true,
        group: OnboardingTaskGroup.GETTING_STARTED,
      },
      {
        task: OnboardingTaskKey.RELEASE_GUIDE,
        title: t('Releases'),
        description: t(
          'Track the health of every release. See differences between releases from crash analytics to adoption rates.'
        ),
        skippable: false,
        actionType: 'app',
        location: makeReleasesPathname({
          organization,
          path: '/',
        }),
        display: true,
        group: OnboardingTaskGroup.GETTING_STARTED,
      },
    ];
  }

  return [
    {
      task: OnboardingTaskKey.FIRST_PROJECT,
      title: t('Create your first project'),
      description: t(
        'Select your platform and install the Sentry SDK by adding a few lines of code to your application. HINT: Set up a separate project for each part of your application (for example, your API server and frontend client).'
      ),
      skippable: false,
      actionType: 'app',
      location: makeProjectsPathname({path: '/new/', organization}),
      display: true,
      group: OnboardingTaskGroup.GETTING_STARTED,
    },
    {
      task: OnboardingTaskKey.FIRST_EVENT,
      title: t('Capture your first error'),
      description: t(
        'Throw an error using our example code to make sure things are working as expected.'
      ),
      skippable: false,
      actionType: 'app',
      location: getOnboardingInstructionsUrl({projects, organization}),
      display: true,
      group: OnboardingTaskGroup.GETTING_STARTED,
    },
    {
      task: OnboardingTaskKey.INVITE_MEMBER,
      title: t('Invite your team'),
      description: t(
        'Assign issues and comment on shared errors with coworkers so you always know who to blame when sh*t hits the fan.'
      ),
      skippable: true,
      actionType: 'action',
      action: () => openInviteMembersModal({source: 'onboarding_widget'}),
      display: true,
      group: OnboardingTaskGroup.GETTING_STARTED,
    },
    {
      task: OnboardingTaskKey.REAL_TIME_NOTIFICATIONS,
      title: t('Get real-time notifications'),
      description: t(
        'Triage and resolve issues faster by integrating Sentry with messaging platforms like Slack, Discord, and MS Teams.'
      ),
      skippable: true,
      actionType: 'app',
      location: `/settings/${organization.slug}/integrations/?category=chat`,
      display: true,
    },
    {
      task: OnboardingTaskKey.LINK_SENTRY_TO_SOURCE_CODE,
      title: t('Link Sentry to Source Code'),
      description: t(
        'Resolve bugs faster with commit data and stack trace linking to your source code in GitHub, Gitlab, and more.'
      ),
      skippable: true,
      actionType: 'app',
      location: {
        pathname: `/settings/${organization.slug}/integrations/`,
        query: {category: 'source code management'},
      },
      display: true,
      group: OnboardingTaskGroup.GETTING_STARTED,
    },
    {
      task: OnboardingTaskKey.SECOND_PLATFORM,
      title: t('Add Sentry to other parts of your app'),
      description: t(
        'Create a new project and install Sentry in other parts of your app—such as the backend, frontend, API server—to quickly see where a problem’s coming from'
      ),
      skippable: true,
      actionType: 'app',
      location: makeProjectsPathname({path: '/new/', organization}),
      display: true,
    },
    {
      task: OnboardingTaskKey.FIRST_TRANSACTION,
      title: t('Set up Tracing'),
      description: t(
        'Instrument tracing in your frontend and backend to identify application performance issues and debug errors across your stack.'
      ),
      skippable: true,
      actionType: 'action',
      action: router => {
        // TODO: add analytics here for this specific action.

        if (!projects) {
          navigateTo(performanceUrl, router);
          return;
        }

        const {projectsWithoutFirstTransactionEvent, projectsForOnboarding} =
          filterProjects(projects);

        if (projectsWithoutFirstTransactionEvent.length <= 0) {
          navigateTo(performanceUrl, router);
          return;
        }

        if (projectsForOnboarding.length) {
          navigateTo(
            `${performanceUrl}?project=${projectsForOnboarding[0]!.id}#performance-sidequest`,
            router
          );
          return;
        }

        navigateTo(
          `${performanceUrl}?project=${projectsWithoutFirstTransactionEvent[0]!.id}#performance-sidequest`,
          router
        );
      },
      display: true,
    },
    {
      task: OnboardingTaskKey.SESSION_REPLAY,
      title: t('Set up Session Replay'),
      description: t(
        'Get video-like reproductions of user sessions to see what happened before, during, and after an error or performance issue occurred.'
      ),
      skippable: true,
      actionType: 'action',
      action: router => {
        router.push({
          pathname: makeReplaysPathname({
            path: '/',
            organization,
          }),
          query: {referrer: 'onboarding_task'},
        });
        // Since the quick start panel is already open and closes on route change
        // Wait for the next tick to open the replay onboarding panel
        setTimeout(() => {
          OnboardingDrawerStore.open(OnboardingDrawerKey.REPLAYS_ONBOARDING);
        }, 0);
      },
      display: organization.features?.includes('session-replay'),
    },
    {
      task: OnboardingTaskKey.RELEASE_TRACKING,
      title: t('Track releases'),
      description: t(
        'Identify which release introduced an issue and track release health with crash analytics, errors, and adoption data.'
      ),
      skippable: true,
      actionType: 'app',
      location: makeReleasesPathname({
        organization,
        path: '/',
      }),
      display: true,
      group: OnboardingTaskGroup.GETTING_STARTED,
    },
    {
      task: OnboardingTaskKey.SOURCEMAPS,
      title: t('Unminify your code'),
      description: t(
        'Enable readable stack traces in Sentry errors by uploading your source maps.'
      ),
      skippable: true,
      actionType: 'external',
      location: 'https://docs.sentry.io/platforms/javascript/sourcemaps/',
      display: hasPlatformWithSourceMaps(projects),
    },
    {
      task: OnboardingTaskKey.ALERT_RULE,
      title: t('Configure an Issue Alert'),
      description: t(
        'We all have issues. Get real-time error notifications by setting up alerts for issues that match your set criteria.'
      ),
      skippable: true,
      actionType: 'app',
      location: getIssueAlertUrl({projects, organization}),
      display: true,
      group: OnboardingTaskGroup.GETTING_STARTED,
    },
  ];
}

export function getMergedTasks({organization, projects}: Options) {
  const taskDescriptors = getOnboardingTasks({organization, projects});
  const serverTasks = isDemoModeActive()
    ? getDemoWalkthroughTasks()
    : organization.onboardingTasks;

  // Map server task state (i.e. completed status) with tasks objects
  const allTasks = taskDescriptors.map(
    desc =>
      ({
        ...desc,
        ...serverTasks.find(
          serverTask =>
            serverTask.task === desc.task || serverTask.task === desc.serverTask
        ),
      }) as OnboardingTask
  );

  const supportedTasks = filterSupportedTasks(projects, allTasks);
  return supportedTasks;
}

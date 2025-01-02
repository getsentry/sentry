import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import type {OnboardingContextProps} from 'sentry/components/onboarding/onboardingContext';
import {filterSupportedTasks} from 'sentry/components/onboardingWizard/filterSupportedTasks';
import {
  hasQuickStartUpdatesFeature,
  hasQuickStartUpdatesFeatureGA,
  taskIsDone,
} from 'sentry/components/onboardingWizard/utils';
import {filterProjects} from 'sentry/components/performanceOnboarding/utils';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {Tooltip} from 'sentry/components/tooltip';
import {sourceMaps} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import type {
  OnboardingSupplementComponentProps,
  OnboardingTask,
  OnboardingTaskDescriptor,
} from 'sentry/types/onboarding';
import {OnboardingTaskGroup, OnboardingTaskKey} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import EventWaiter from 'sentry/utils/eventWaiter';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {getPerformanceBaseUrl} from 'sentry/views/performance/utils';

function hasPlatformWithSourceMaps(projects: Project[] | undefined) {
  return projects !== undefined
    ? projects.some(({platform}) => platform && sourceMaps.includes(platform))
    : false;
}

type Options = {
  /**
   * The organization to show onboarding tasks for
   */
  organization: Organization;
  onboardingContext?: OnboardingContextProps;

  /**
   * A list of the organizations projects. This is used for some onboarding
   * tasks to show additional task details (such as for suggesting sourcemaps)
   */
  projects?: Project[];
};

function getIssueAlertUrl({projects, organization}: Options) {
  if (!projects || !projects.length) {
    return `/organizations/${organization.slug}/alerts/rules/`;
  }
  // pick the first project with events if we have that, otherwise just pick the first project
  const firstProjectWithEvents = projects.find(project => !!project.firstEvent);
  const project = firstProjectWithEvents ?? projects[0]!;
  return `/organizations/${organization.slug}/alerts/${project.slug}/wizard/`;
}

function getOnboardingInstructionsUrl({projects, organization}: Options) {
  // This shall never be the case, since this is step is locked until a project is created,
  // but if the user falls into this case for some reason,
  // he needs to select the platform again since it is not available as a parameter here
  if (!projects || !projects.length) {
    return `/${organization.slug}/:projectId/getting-started/`;
  }

  const allProjectsWithoutErrors = projects.every(project => !project.firstEvent);
  // If all created projects don't have any errors,
  // we ask the user to pick a project before navigating to the instructions
  if (allProjectsWithoutErrors) {
    return `/${organization.slug}/:projectId/getting-started/`;
  }

  // Pick the first project without an error
  const firstProjectWithoutError = projects.find(project => !project.firstEvent);
  // If all projects contain errors, this step will not be visible to the user,
  // but if the user falls into this case for some reason, we pick the first project
  const project = firstProjectWithoutError ?? projects[0]!;

  let url = `/${organization.slug}/${project.slug}/getting-started/`;

  if (project.platform) {
    url = url + `${project.platform}/`;
  }

  return url;
}

function getMetricAlertUrl({projects, organization}: Options) {
  if (!projects || !projects.length) {
    return `/organizations/${organization.slug}/alerts/rules/`;
  }
  // pick the first project with transaction events if we have that, otherwise just pick the first project
  const firstProjectWithEvents = projects.find(
    project => !!project.firstTransactionEvent
  );
  const project = firstProjectWithEvents ?? projects[0]!;
  return {
    pathname: `/organizations/${organization.slug}/alerts/${project.slug}/wizard/`,
    query: {
      alert_option: 'trans_duration',
    },
  };
}

export function getOnboardingTasks({
  organization,
  projects,
  onboardingContext,
}: Options): OnboardingTaskDescriptor[] {
  const performanceUrl = `${getPerformanceBaseUrl(organization.slug)}/`;

  if (isDemoModeEnabled()) {
    return [
      {
        task: OnboardingTaskKey.ISSUE_GUIDE,
        title: t('Issues'),
        description: t(
          'Here’s a list of errors and performance problems. And everything you need to know to fix it.'
        ),
        skippable: false,
        requisites: [],
        actionType: 'app',
        location: `/organizations/${organization.slug}/issues/`,
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
        requisites: [],
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
        requisites: [],
        actionType: 'app',
        location: `/organizations/${organization.slug}/releases/`,
        display: true,
        group: OnboardingTaskGroup.GETTING_STARTED,
      },
      {
        task: OnboardingTaskKey.SIDEBAR_GUIDE,
        title: t('Check out the different tabs'),
        description: t('Press the start button for a guided tour through each tab.'),
        skippable: false,
        requisites: [],
        actionType: 'app',
        location: `/organizations/${organization.slug}/projects/`,
        display: true,
        group: OnboardingTaskGroup.GETTING_STARTED,
      },
    ];
  }
  return [
    {
      task: OnboardingTaskKey.FIRST_PROJECT,
      title: hasQuickStartUpdatesFeature(organization)
        ? t('Create your first project')
        : t('Create a project'),
      description: hasQuickStartUpdatesFeature(organization)
        ? t(
            'Select your platform and install the Sentry SDK by adding a few lines of code to your application. HINT: Set up a separate project for each part of your application (for example, your API server and frontend client).'
          )
        : t(
            "Monitor in seconds by adding a simple lines of code to your project. It's as easy as microwaving leftover pizza."
          ),
      skippable: false,
      requisites: [],
      actionType: 'app',
      location: `/organizations/${organization.slug}/projects/new/`,
      display: true,
      group: OnboardingTaskGroup.GETTING_STARTED,
    },
    {
      task: OnboardingTaskKey.FIRST_EVENT,
      title: t('Capture your first error'),
      description: hasQuickStartUpdatesFeature(organization)
        ? t(
            'Throw an error using our example code to make sure things are working as expected.'
          )
        : t(
            "Time to test it out. Now that you've created a project, capture your first error. We've got an example you can fiddle with."
          ),
      skippable: false,
      requisites: [OnboardingTaskKey.FIRST_PROJECT],
      actionType: 'app',
      location: getOnboardingInstructionsUrl({projects, organization}),
      display: true,
      SupplementComponent: ({
        task,
        onCompleteTask,
      }: OnboardingSupplementComponentProps) => {
        const api = useApi();

        if (hasQuickStartUpdatesFeature(organization)) {
          if (!projects?.length || task.requisiteTasks.length > 0 || taskIsDone(task)) {
            return null;
          }
          return (
            <EventWaitingIndicator
              text={t('Waiting for error')}
              hasQuickStartUpdatesFeature
              hasQuickStartUpdatesFeatureGA={hasQuickStartUpdatesFeatureGA(organization)}
            />
          );
        }

        return !!projects?.length &&
          task.requisiteTasks.length === 0 &&
          !task.completionSeen ? (
          <EventWaiter
            api={api}
            organization={organization}
            project={projects[0]!}
            eventType="error"
            onIssueReceived={() => !taskIsDone(task) && onCompleteTask?.()}
          >
            {() => <EventWaitingIndicator text={t('Waiting for error')} />}
          </EventWaiter>
        ) : null;
      },
      group: OnboardingTaskGroup.GETTING_STARTED,
    },
    {
      task: OnboardingTaskKey.INVITE_MEMBER,
      title: t('Invite your team'),
      description: t(
        'Assign issues and comment on shared errors with coworkers so you always know who to blame when sh*t hits the fan.'
      ),
      skippable: true,
      requisites: [],
      actionType: 'action',
      action: () => openInviteMembersModal({source: 'onboarding_widget'}),
      display: true,
      group: OnboardingTaskGroup.GETTING_STARTED,
      pendingTitle: t(
        'You’ve invited members, and their acceptance is pending. Keep an eye out for updates!'
      ),
    },
    {
      task: OnboardingTaskKey.FIRST_INTEGRATION,
      title: t('Install any of our 40+ integrations'),
      description: t(
        'Get alerted in Slack. Two-way sync issues between Sentry and Jira. Notify Sentry of releases from GitHub, Vercel, or Netlify.'
      ),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.FIRST_EVENT],
      actionType: 'app',
      location: `/settings/${organization.slug}/integrations/`,
      display: !hasQuickStartUpdatesFeature(organization),
    },
    {
      task: OnboardingTaskKey.REAL_TIME_NOTIFICATIONS,
      title: t('Get real-time notifications'),
      description: t(
        'Triage and resolve issues faster by integrating Sentry with messaging platforms like Slack, Discord, and MS Teams.'
      ),
      skippable: true,
      requisites: [],
      actionType: 'app',
      location: `/settings/${organization.slug}/integrations/?category=chat`,
      display: hasQuickStartUpdatesFeature(organization),
    },
    {
      task: OnboardingTaskKey.LINK_SENTRY_TO_SOURCE_CODE,
      title: t('Link Sentry to Source Code'),
      description: t(
        'Resolve bugs faster with commit data and stack trace linking to your source code in GitHub, Gitlab, and more.'
      ),
      skippable: true,
      requisites: [],
      actionType: 'app',
      location: {
        pathname: `/settings/${organization.slug}/integrations/`,
        query: {category: 'source code management'},
      },
      display: hasQuickStartUpdatesFeature(organization),
      group: OnboardingTaskGroup.GETTING_STARTED,
    },
    {
      task: OnboardingTaskKey.SECOND_PLATFORM,
      title: hasQuickStartUpdatesFeature(organization)
        ? t('Add Sentry to other parts of your app')
        : t('Create another project'),
      description: hasQuickStartUpdatesFeature(organization)
        ? t(
            'Create a new project and install Sentry in other parts of your app—such as the backend, frontend, API server—to quickly see where a problem’s coming from'
          )
        : t(
            'Easy, right? Don’t stop at one. Set up another project and send it events to keep things running smoothly in both the frontend and backend.'
          ),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.FIRST_EVENT],
      actionType: 'app',
      location: `/organizations/${organization.slug}/projects/new/`,
      display: true,
      pendingTitle: t('Awaiting an error for this project.'),
      SupplementComponent: ({task}: OnboardingSupplementComponentProps) => {
        if (hasQuickStartUpdatesFeature(organization)) {
          return null;
        }
        if (!projects?.length || task.requisiteTasks.length > 0 || taskIsDone(task)) {
          return null;
        }
        return (
          <EventWaitingIndicator
            text={t('Waiting for error')}
            hasQuickStartUpdatesFeature
            hasQuickStartUpdatesFeatureGA={hasQuickStartUpdatesFeatureGA(organization)}
          />
        );
      },
    },
    {
      task: OnboardingTaskKey.FIRST_TRANSACTION,
      title: hasQuickStartUpdatesFeature(organization)
        ? t('Set up Tracing')
        : t('Boost performance'),
      description: hasQuickStartUpdatesFeature(organization)
        ? t(
            'Instrument tracing in your frontend and backend to identify application performance issues and debug errors across your stack.'
          )
        : t(
            "Don't keep users waiting. Trace transactions, investigate spans and cross-reference related issues for those mission-critical endpoints."
          ),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT],
      actionType: 'action',
      action: router => {
        // Use `features?.` because getsentry has a different `Organization` type/payload
        if (!organization.features?.includes('performance-onboarding-checklist')) {
          window.open(
            'https://docs.sentry.io/product/performance/getting-started/',
            '_blank'
          );
          return;
        }

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
      SupplementComponent: ({
        task,
        onCompleteTask,
      }: OnboardingSupplementComponentProps) => {
        const api = useApi();

        if (hasQuickStartUpdatesFeature(organization)) {
          if (!projects?.length || task.requisiteTasks.length > 0 || taskIsDone(task)) {
            return null;
          }
          return (
            <EventWaitingIndicator
              hasQuickStartUpdatesFeature
              hasQuickStartUpdatesFeatureGA={hasQuickStartUpdatesFeatureGA(organization)}
            />
          );
        }

        return !!projects?.length &&
          task.requisiteTasks.length === 0 &&
          !task.completionSeen ? (
          <EventWaiter
            api={api}
            organization={organization}
            project={projects[0]!}
            eventType="transaction"
            onIssueReceived={() => !taskIsDone(task) && onCompleteTask?.()}
          >
            {() => <EventWaitingIndicator />}
          </EventWaiter>
        ) : null;
      },
    },
    {
      task: OnboardingTaskKey.USER_CONTEXT,
      title: t('Get more user context'),
      description: t(
        'Enable us to pinpoint which users are suffering from that bad code, so you can debug the problem more swiftly and maybe even apologize for it.'
      ),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.FIRST_EVENT],
      actionType: 'external',
      location:
        'https://docs.sentry.io/platform-redirect/?next=/enriching-events/identify-user/',
      display: !hasQuickStartUpdatesFeature(organization),
    },
    {
      task: OnboardingTaskKey.SESSION_REPLAY,
      title: hasQuickStartUpdatesFeature(organization)
        ? t('Set up Session Replay')
        : t('See a video-like reproduction'),
      description: hasQuickStartUpdatesFeature(organization)
        ? t(
            'Get video-like reproductions of user sessions to see what happened before, during, and after an error or performance issue occurred.'
          )
        : t(
            'Get to the root cause of error or latency issues faster by seeing all the technical details related to those issues in video-like reproductions of your user sessions.'
          ),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.FIRST_EVENT],
      actionType: 'action',
      action: router => {
        router.push(
          normalizeUrl({
            pathname: `/organizations/${organization.slug}/replays/`,
            query: {referrer: 'onboarding_task'},
          })
        );
        // Since the quick start panel is already open and closes on route change
        // Wait for the next tick to open the replay onboarding panel
        setTimeout(() => {
          SidebarPanelStore.activatePanel(SidebarPanelKey.REPLAYS_ONBOARDING);
        }, 0);
      },
      display: organization.features?.includes('session-replay'),
      SupplementComponent: ({
        task,
        onCompleteTask,
      }: OnboardingSupplementComponentProps) => {
        const api = useApi();

        if (hasQuickStartUpdatesFeature(organization)) {
          if (!projects?.length || task.requisiteTasks.length > 0 || taskIsDone(task)) {
            return null;
          }

          return (
            <EventWaitingIndicator
              text={t('Waiting for user session')}
              hasQuickStartUpdatesFeature
              hasQuickStartUpdatesFeatureGA={hasQuickStartUpdatesFeatureGA(organization)}
            />
          );
        }

        return !!projects?.length &&
          task.requisiteTasks.length === 0 &&
          !task.completionSeen ? (
          <EventWaiter
            api={api}
            organization={organization}
            project={projects[0]!}
            eventType="replay"
            onIssueReceived={() => !taskIsDone(task) && onCompleteTask?.()}
          >
            {() => <EventWaitingIndicator text={t('Waiting for user session')} />}
          </EventWaiter>
        ) : null;
      },
    },
    {
      task: OnboardingTaskKey.RELEASE_TRACKING,
      title: t('Track releases'),
      description: hasQuickStartUpdatesFeature(organization)
        ? t(
            'Identify which release introduced an issue and track release health with crash analytics, errors, and adoption data.'
          )
        : t(
            'Take an in-depth look at the health of each and every release with crash analytics, errors, related issues and suspect commits.'
          ),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.FIRST_EVENT],
      actionType: 'app',
      location: `/organizations/${organization.slug}/releases/`,
      display: true,
      group: OnboardingTaskGroup.GETTING_STARTED,
    },
    {
      task: OnboardingTaskKey.SOURCEMAPS,
      title: hasQuickStartUpdatesFeature(organization)
        ? t('Unminify your code')
        : t('Upload source maps'),
      description: hasQuickStartUpdatesFeature(organization)
        ? t(
            'Enable readable stack traces in Sentry errors by uploading your source maps.'
          )
        : t(
            'Deminify Javascript source code to debug with context. Seeing code in its original form will help you debunk the ghosts of errors past.'
          ),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.FIRST_EVENT],
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
      requisites: [OnboardingTaskKey.FIRST_PROJECT],
      actionType: 'app',
      location: getIssueAlertUrl({projects, organization, onboardingContext}),
      display: true,
      group: OnboardingTaskGroup.GETTING_STARTED,
    },
    {
      task: OnboardingTaskKey.METRIC_ALERT,
      title: t('Create a Performance Alert'),
      description: t(
        'See slow fast with performance alerts. Set up alerts for notifications about slow page load times, API latency, or when throughput significantly deviates from normal.'
      ),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.FIRST_TRANSACTION],
      actionType: 'app',
      location: getMetricAlertUrl({projects, organization, onboardingContext}),
      // Use `features?.` because getsentry has a different `Organization` type/payload
      display:
        organization.features?.includes('incidents') &&
        !hasQuickStartUpdatesFeature(organization),
    },
  ];
}

export function getMergedTasks({organization, projects, onboardingContext}: Options) {
  const taskDescriptors = getOnboardingTasks({organization, projects, onboardingContext});
  const serverTasks = organization.onboardingTasks;

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
      }) as OnboardingTask
  );

  const supportedTasks = filterSupportedTasks(projects, allTasks);
  // Map incomplete requisiteTasks as full task objects
  return supportedTasks.map(task => ({
    ...task,
    requisiteTasks: task.requisites
      .map(key => supportedTasks.find(task2 => task2.task === key)!)
      .filter(reqTask => reqTask.status !== 'complete'),
  }));
}

const PulsingIndicator = styled('div')<{
  hasQuickStartUpdatesFeature?: boolean;
  hasQuickStartUpdatesFeatureGA?: boolean;
}>`
  ${pulsingIndicatorStyles};
  ${p =>
    p.hasQuickStartUpdatesFeatureGA
      ? css`
          margin: 0;
        `
      : p.hasQuickStartUpdatesFeature
        ? css`
            margin: 0 ${space(0.5)};
          `
        : css`
            margin-right: ${space(1)};
          `}
`;

const EventWaitingIndicator = styled(
  ({
    hasQuickStartUpdatesFeature: quickStartUpdatesFeature,
    hasQuickStartUpdatesFeatureGA: quickStartUpdatesFeatureGA,
    text,
    ...p
  }: React.HTMLAttributes<HTMLDivElement> & {
    hasQuickStartUpdatesFeature?: boolean;
    hasQuickStartUpdatesFeatureGA?: boolean;
    text?: string;
  }) => {
    if (quickStartUpdatesFeature) {
      return (
        <div {...p}>
          <Tooltip title={text || t('Waiting for event')}>
            <PulsingIndicator
              hasQuickStartUpdatesFeature
              hasQuickStartUpdatesFeatureGA={quickStartUpdatesFeatureGA}
            />
          </Tooltip>
        </div>
      );
    }
    return (
      <div {...p}>
        <PulsingIndicator />
        {text || t('Waiting for event')}
      </div>
    );
  }
)`
  display: flex;
  align-items: center;
  ${p =>
    p.hasQuickStartUpdatesFeature
      ? css`
          height: 16px;
        `
      : css`
          flex-grow: 1;
          font-size: ${p.theme.fontSizeMedium};
          color: ${p.theme.pink400};
        `}
`;

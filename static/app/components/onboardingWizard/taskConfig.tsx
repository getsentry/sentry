import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import type {Client} from 'sentry/api';
import type {OnboardingContextProps} from 'sentry/components/onboarding/onboardingContext';
import {filterSupportedTasks} from 'sentry/components/onboardingWizard/filterSupportedTasks';
import {
  hasQuickStartUpdatesFeature,
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
import {isDemoWalkthrough} from 'sentry/utils/demoMode';
import EventWaiter from 'sentry/utils/eventWaiter';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import withApi from 'sentry/utils/withApi';

function hasPlatformWithSourceMaps(projects: Project[] | undefined) {
  return projects !== undefined
    ? projects.some(({platform}) => platform && sourceMaps.includes(platform))
    : false;
}

type FirstEventWaiterProps = OnboardingSupplementComponentProps & {
  api: Client;
};

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
  const project = firstProjectWithEvents ?? projects[0];
  return `/organizations/${organization.slug}/alerts/${project.slug}/wizard/`;
}

function getOnboardingInstructionsUrl({projects, organization}: Options) {
  // This shall never be the case, since this is step is locked until a project is created,
  // but if the user falls into this case for some reason,
  // he needs to select the platform again since it is not available as a parameter here
  if (!projects || !projects.length) {
    return `/getting-started/:projectId/`;
  }

  const allProjectsWithoutErrors = projects.every(project => !project.firstEvent);
  // If all created projects don't have any errors,
  // we ask the user to pick a project before navigating to the instructions
  if (allProjectsWithoutErrors) {
    return `/getting-started/:projectId/`;
  }

  // Pick the first project without an error
  const firstProjectWithoutError = projects.find(project => !project.firstEvent);
  // If all projects contain errors, this step will not be visible to the user,
  // but if the user falls into this case for some reason, we pick the first project
  const project = firstProjectWithoutError ?? projects[0];

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
  const project = firstProjectWithEvents ?? projects[0];
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
  if (isDemoWalkthrough()) {
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
        location: `/organizations/${organization.slug}/performance/`,
        display: true,
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
      },
    ];
  }
  return [
    {
      task: OnboardingTaskKey.FIRST_PROJECT,
      title: t('Create a project'),
      description: hasQuickStartUpdatesFeature(organization)
        ? t(
            "Monitor in seconds by adding a few lines of code to your project. It's as easy as microwaving leftover pizza."
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
      description: t(
        "Time to test it out. Now that you've created a project, capture your first error. We've got an example you can fiddle with."
      ),
      skippable: false,
      requisites: [OnboardingTaskKey.FIRST_PROJECT],
      actionType: 'app',
      location: getOnboardingInstructionsUrl({projects, organization}),
      display: true,
      SupplementComponent: withApi(
        ({api, task, onCompleteTask}: FirstEventWaiterProps) =>
          !!projects?.length &&
          task.requisiteTasks.length === 0 &&
          !task.completionSeen ? (
            <EventWaiter
              api={api}
              organization={organization}
              project={projects[0]}
              eventType="error"
              onIssueReceived={() => !taskIsDone(task) && onCompleteTask()}
            >
              {() => (
                <EventWaitingIndicator
                  text={t('Waiting for error')}
                  hasQuickStartUpdatesFeature={hasQuickStartUpdatesFeature(organization)}
                />
              )}
            </EventWaiter>
          ) : null
      ),
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
      title: t('Real-time notifications'),
      description: t(
        'Triage and resolving issues faster by integrating Sentry with messaging platforms like Slack, Discord and MS Teams.'
      ),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.FIRST_EVENT],
      actionType: 'app',
      location: `/settings/${organization.slug}/integrations/?category=chat`,
      display: hasQuickStartUpdatesFeature(organization),
    },
    {
      task: OnboardingTaskKey.LINK_SENTRY_TO_SOURCE_CODE,
      title: t('Link Sentry to Source Code'),
      description: t(
        'Resolve bugs faster with commit data and stack trace linking to your source code in GitHub, Gitlab and more.'
      ),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.FIRST_EVENT],
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
      title: t('Create another project'),
      description: t(
        'Easy, right? Don’t stop at one. Set up another project and send it events to keep things running smoothly in both the frontend and backend.'
      ),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.FIRST_EVENT],
      actionType: 'app',
      location: `/organizations/${organization.slug}/projects/new/`,
      display: true,
    },
    {
      task: OnboardingTaskKey.FIRST_TRANSACTION,
      title: t('Boost performance'),
      description: t(
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
          navigateTo(`/organizations/${organization.slug}/performance/`, router);
          return;
        }

        const {projectsWithoutFirstTransactionEvent, projectsForOnboarding} =
          filterProjects(projects);

        if (projectsWithoutFirstTransactionEvent.length <= 0) {
          navigateTo(`/organizations/${organization.slug}/performance/`, router);
          return;
        }

        if (projectsForOnboarding.length) {
          navigateTo(
            `/organizations/${organization.slug}/performance/?project=${projectsForOnboarding[0].id}#performance-sidequest`,
            router
          );
          return;
        }

        navigateTo(
          `/organizations/${organization.slug}/performance/?project=${projectsWithoutFirstTransactionEvent[0].id}#performance-sidequest`,
          router
        );
      },
      display: true,
      SupplementComponent: withApi(
        ({api, task, onCompleteTask}: FirstEventWaiterProps) =>
          !!projects?.length &&
          task.requisiteTasks.length === 0 &&
          !task.completionSeen ? (
            <EventWaiter
              api={api}
              organization={organization}
              project={projects[0]}
              eventType="transaction"
              onIssueReceived={() => !taskIsDone(task) && onCompleteTask()}
            >
              {() => (
                <EventWaitingIndicator
                  hasQuickStartUpdatesFeature={hasQuickStartUpdatesFeature(organization)}
                />
              )}
            </EventWaiter>
          ) : null
      ),
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
      title: t('See a video-like reproduction'),
      description: t(
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
      SupplementComponent: withApi(
        ({api, task, onCompleteTask}: FirstEventWaiterProps) =>
          !!projects?.length &&
          task.requisiteTasks.length === 0 &&
          !task.completionSeen ? (
            <EventWaiter
              api={api}
              organization={organization}
              project={projects[0]}
              eventType="replay"
              onIssueReceived={() => !taskIsDone(task) && onCompleteTask()}
            >
              {() => (
                <EventWaitingIndicator
                  hasQuickStartUpdatesFeature={hasQuickStartUpdatesFeature(organization)}
                  text={t('Waiting for user session')}
                />
              )}
            </EventWaiter>
          ) : null
      ),
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
      location: `/settings/${organization.slug}/projects/:projectId/release-tracking/`,
      display: true,
      group: OnboardingTaskGroup.GETTING_STARTED,
    },
    {
      task: OnboardingTaskKey.SOURCEMAPS,
      title: t('Upload source maps'),
      description: t(
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

const PulsingIndicator = styled('div')<{hasQuickStartUpdatesFeature?: boolean}>`
  ${pulsingIndicatorStyles};
  ${p =>
    p.hasQuickStartUpdatesFeature
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
    text,
    ...p
  }: React.HTMLAttributes<HTMLDivElement> & {
    hasQuickStartUpdatesFeature: boolean;
    text?: string;
  }) => {
    if (quickStartUpdatesFeature) {
      return (
        <div {...p}>
          <Tooltip title={text || t('Waiting for event')}>
            <PulsingIndicator hasQuickStartUpdatesFeature />
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

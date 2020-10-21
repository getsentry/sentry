import styled from '@emotion/styled';

import {t} from 'app/locale';
import {openInviteMembersModal} from 'app/actionCreators/modal';
import {sourceMaps} from 'app/data/platformCategories';
import {
  Organization,
  OnboardingTaskDescriptor,
  OnboardingTaskKey,
  OnboardingTask,
  Project,
  OnboardingSupplementComponentProps,
} from 'app/types';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import withProjects from 'app/utils/withProjects';
import EventWaiter from 'app/utils/eventWaiter';
import {taskIsDone} from 'app/components/onboardingWizard/utils';
import pulsingIndicatorStyles from 'app/styles/pulsingIndicator';
import space from 'app/styles/space';

function hasPlatformWithSourceMaps(organization: Organization): boolean {
  const projects = organization?.projects;
  if (!projects) {
    return false;
  }

  return projects.some(({platform}) => platform && sourceMaps.includes(platform));
}

type FirstEventWaiterProps = OnboardingSupplementComponentProps & {
  api: Client;
  projects: Project[];
};

export function getOnboardingTasks(
  organization: Organization
): OnboardingTaskDescriptor[] {
  return [
    {
      task: OnboardingTaskKey.FIRST_PROJECT,
      title: t('Create a project'),
      description: t('Create your first Sentry project'),
      detailedDescription: t(
        'Follow our quick and easy steps to set up a project and start sending errors.'
      ),
      skippable: false,
      requisites: [],
      actionType: 'app',
      location: `/organizations/${organization.slug}/projects/new/`,
      display: true,
    },
    {
      task: OnboardingTaskKey.FIRST_EVENT,
      title: t('Send your first event'),
      description: t('Install the appropriate Sentry SDK for your application'),
      detailedDescription: t('Choose your platform and send an event.'),
      skippable: false,
      requisites: [OnboardingTaskKey.FIRST_PROJECT],
      actionType: 'app',
      location: `/settings/${organization.slug}/projects/:projectId/install/`,
      display: true,
      SupplementComponent: withProjects(
        withApi(({api, task, projects, onCompleteTask}: FirstEventWaiterProps) =>
          projects.length > 0 &&
          task.requisiteTasks.length === 0 &&
          !task.completionSeen ? (
            <EventWaiter
              api={api}
              organization={organization}
              project={projects[0]}
              eventType="error"
              onIssueReceived={() => !taskIsDone(task) && onCompleteTask()}
            >
              {() => <EventWaitingIndicator />}
            </EventWaiter>
          ) : null
        )
      ),
    },
    {
      task: OnboardingTaskKey.INVITE_MEMBER,
      title: t('Invite team members'),
      description: t('Bring your team aboard'),
      detailedDescription: t(
        `Let Sentry help your team triage and assign issues. Improve your workflow
        by unlocking mentions, assignment, and suggested issue owners.`
      ),
      skippable: true,
      requisites: [],
      actionType: 'action',
      action: () => openInviteMembersModal({source: 'onboarding_widget'}),
      display: true,
    },
    {
      task: OnboardingTaskKey.SECOND_PLATFORM,
      title: t('Add a second platform'),
      description: t('Add Sentry to a second platform'),
      detailedDescription: t('Capture errors from both your front and back ends.'),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.FIRST_EVENT],
      actionType: 'app',
      location: `/organizations/${organization.slug}/projects/new/`,
      display: true,
    },
    {
      task: OnboardingTaskKey.FIRST_TRANSACTION,
      title: t('Monitor Performance'),
      description: t('See slow faster'),
      detailedDescription: t(
        `Set up Performance Monitoring to see everything from macro-level metrics to micro-level spans.
        Cross-reference transactions with related issues, customize queries, and monitor mission-critical endpoints using metric alerts.`
      ),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT],
      actionType: 'external',
      location: 'https://docs.sentry.io/product/performance/getting-started/',
      display: true,
      SupplementComponent: withProjects(
        withApi(({api, task, projects, onCompleteTask}: FirstEventWaiterProps) =>
          projects.length > 0 &&
          task.requisiteTasks.length === 0 &&
          !task.completionSeen ? (
            <EventWaiter
              api={api}
              organization={organization}
              project={projects[0]}
              eventType="transaction"
              onIssueReceived={() => !taskIsDone(task) && onCompleteTask()}
            >
              {() => <EventWaitingIndicator />}
            </EventWaiter>
          ) : null
        )
      ),
    },
    {
      task: OnboardingTaskKey.USER_CONTEXT,
      title: t('Add user context'),
      description: t('Know who is being affected by crashes'),
      detailedDescription: t(
        `Unlock features that let you drill down into the number of users affected by an issue
        and get a broader sense about the quality of your application.`
      ),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.FIRST_EVENT],
      actionType: 'external',
      location: 'https://docs.sentry.io/enriching-error-data/context/#capturing-the-user',
      display: true,
    },
    {
      task: OnboardingTaskKey.RELEASE_TRACKING,
      title: t('Set up release tracking'),
      description: t('See which releases cause errors'),
      detailedDescription: t(
        `Set up releases and associate commits to gain additional context when determining the
        cause of an issue and unlock the ability to resolve issues via commit message.`
      ),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.FIRST_EVENT],
      actionType: 'app',
      location: `/settings/${organization.slug}/projects/:projectId/release-tracking/`,
      display: true,
    },
    {
      task: OnboardingTaskKey.SOURCEMAPS,
      title: t('Upload source maps'),
      description: t('Deminify JavaScript stack traces'),
      detailedDescription: t(
        `View source code context obtained from stack traces in its
        original untransformed form, which is particularly useful for debugging minified code.`
      ),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.FIRST_EVENT],
      actionType: 'external',
      location: 'https://docs.sentry.io/platforms/javascript/sourcemaps/',
      display: hasPlatformWithSourceMaps(organization),
    },
    {
      task: OnboardingTaskKey.USER_REPORTS,
      title: 'User crash reports',
      description: t('Collect user feedback when your application crashes'),
      skippable: true,
      requisites: [
        OnboardingTaskKey.FIRST_PROJECT,
        OnboardingTaskKey.FIRST_EVENT,
        OnboardingTaskKey.USER_CONTEXT,
      ],
      actionType: 'app',
      location: `/settings/${organization.slug}/projects/:projectId/user-reports/`,
      display: false,
    },
    {
      task: OnboardingTaskKey.ISSUE_TRACKER,
      title: t('Set up issue tracking'),
      description: t('Link to Sentry issues within your issue tracker'),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.FIRST_EVENT],
      actionType: 'app',
      location: `/settings/${organization.slug}/projects/:projectId/plugins/`,
      display: false,
    },
    {
      task: OnboardingTaskKey.ALERT_RULE,
      title: t('Configure alerting rules'),
      description: t('Configure alerting rules to control error emails'),
      detailedDescription: t('Receive Sentry alerts in Slack, PagerDuty, and more.'),
      skippable: true,
      requisites: [OnboardingTaskKey.FIRST_PROJECT],
      actionType: 'app',
      location: `/settings/${organization.slug}/projects/:projectId/alerts/`,
      display: true,
    },
  ];
}

export function getMergedTasks(organization: Organization) {
  const taskDescriptors = getOnboardingTasks(organization);
  const serverTasks = organization.onboardingTasks;

  // Map server task state (i.e. completed status) with tasks objects
  const allTasks = taskDescriptors.map(
    desc =>
      ({
        ...desc,
        ...serverTasks.find(serverTask => serverTask.task === desc.task),
        requisiteTasks: [],
      } as OnboardingTask)
  );

  // Map incomplete requisiteTasks as full task objects
  return allTasks.map(task => ({
    ...task,
    requisiteTasks: task.requisites
      .map(key => allTasks.find(task2 => task2.task === key)!)
      .filter(reqTask => reqTask.status !== 'complete'),
  }));
}

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
`;

const EventWaitingIndicator = styled(p => (
  <div {...p}>
    {t('Waiting for first event')}
    <PulsingIndicator />
  </div>
))`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray700};
  display: grid;
  grid-template-columns: max-content max-content;
  grid-gap: ${space(1)};
  align-items: center;
  line-height: 1rem;
`;

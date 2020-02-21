import {t} from 'app/locale';
import {openInviteMembersModal} from 'app/actionCreators/modal';
import {sourceMaps} from 'app/data/platformCategories';
import {Organization, OnboardingTaskDescriptor} from 'app/types';

function hasPlatformWithSourceMaps(organization: Organization): boolean {
  if (!organization || !organization.projects) {
    return false;
  }
  return organization.projects.some(({platform}) => sourceMaps.includes(platform));
}

export default function getOnboardingTasks(
  organization: Organization
): OnboardingTaskDescriptor[] {
  return [
    {
      task: 1,
      title: t('Create a project'),
      description: t('Create your first Sentry project'),
      detailedDescription: t(
        'Follow our quick and easy steps to set up a project and start sending errors.'
      ),
      skippable: false,
      prereq: [],
      actionType: 'app',
      location: `/organizations/${organization.slug}/projects/new/`,
      display: true,
    },
    {
      task: 2,
      title: t('Send your first event'),
      description: t("Install Sentry's client"),
      detailedDescription: t('Choose your platform and send an event.'),
      skippable: false,
      prereq: [1],
      actionType: 'app',
      location: `/settings/${organization.slug}/projects/:projectId/install/`,
      display: true,
    },
    {
      task: 3,
      title: t('Invite team members'),
      description: t('Bring your team aboard'),
      detailedDescription: t(
        `Let Sentry help your team triage and assign issues. Improve your workflow
        by unlocking mentions, assignment, and suggested issue owners.`
      ),
      skippable: true,
      prereq: [],
      actionType: 'action',
      action: () => openInviteMembersModal({source: 'onboarding_widget'}),
      display: true,
    },
    {
      task: 4,
      title: t('Add a second platform'),
      description: t('Add Sentry to a second platform'),
      detailedDescription: t('Capture errors from both your front and back ends.'),
      skippable: true,
      prereq: [1, 2],
      actionType: 'app',
      location: `/organizations/${organization.slug}/projects/new/`,
      display: true,
    },
    {
      task: 5,
      title: t('Add user context'),
      description: t('Know who is being affected by crashes'),
      detailedDescription: t(
        `Unlock features that let you drill down into the number of users affected by an issue
        and get a broader sense about the quality of your application.`
      ),
      skippable: true,
      prereq: [1, 2],
      actionType: 'external',
      location: 'https://docs.sentry.io/enriching-error-data/context/#capturing-the-user',
      display: true,
    },
    {
      task: 6,
      title: t('Set up release tracking'),
      description: t('See which releases cause errors'),
      detailedDescription: t(
        `Set up releases and associate commits to gain additional context when determining the
        cause of an issue and unlock the ability to resolve issues via commit message.`
      ),
      skippable: true,
      prereq: [1, 2],
      actionType: 'app',
      location: `/settings/${organization.slug}/projects/:projectId/release-tracking/`,
      display: true,
    },
    {
      task: 7,
      title: t('Upload source maps'),
      description: t('Deminify JavaScript stack traces'),
      detailedDescription: t(
        `View source code context obtained from stack traces in its
        original untransformed form, which is particularly useful for debugging minified code.`
      ),
      skippable: true,
      prereq: [1, 2],
      actionType: 'external',
      location: 'https://docs.sentry.io/platforms/javascript/sourcemaps/',
      display: hasPlatformWithSourceMaps(organization),
    },
    {
      task: 8,
      title: 'User crash reports',
      description: t('Collect user feedback when your application crashes'),
      skippable: true,
      prereq: [1, 2, 5],
      actionType: 'app',
      location: `/settings/${organization.slug}/projects/:projectId/user-reports/`,
      display: false,
    },
    {
      task: 9,
      title: t('Set up issue tracking'),
      description: t('Link to Sentry issues within your issue tracker'),
      skippable: true,
      prereq: [1, 2],
      actionType: 'app',
      location: `/settings/${organization.slug}/projects/:projectId/plugins/`,
      display: false,
    },
    {
      task: 10,
      title: t('Set up an alerts service'),
      description: t('Configure alerting rules to control error emails'),
      detailedDescription: t('Receive Sentry alerts in Slack, PagerDuty, and more.'),
      skippable: true,
      prereq: [1],
      actionType: 'app',
      location: `/settings/${organization.slug}/projects/:projectId/alerts/`,
      display: false,
    },
  ];
}

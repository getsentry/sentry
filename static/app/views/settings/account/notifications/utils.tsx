import {OrganizationSummary, Project} from 'sentry/types';
import {NOTIFICATION_SETTINGS_PATHNAMES} from 'sentry/views/settings/account/notifications/constants';

/**
 * Which fine-tuning parts are grouped by project
 */
const notificationsByProject = ['alerts', 'email', 'workflow', 'spikeProtection'];

export const isGroupedByProject = (notificationType: string): boolean =>
  notificationsByProject.includes(notificationType);

export const getParentKey = (notificationType: string): string => {
  return isGroupedByProject(notificationType) ? 'project' : 'organization';
};

export const groupByOrganization = (
  projects: Project[]
): Record<string, {organization: OrganizationSummary; projects: Project[]}> => {
  return projects.reduce<
    Record<string, {organization: OrganizationSummary; projects: Project[]}>
  >((acc, project) => {
    const orgSlug = project.organization.slug;
    if (acc.hasOwnProperty(orgSlug)) {
      acc[orgSlug].projects.push(project);
    } else {
      acc[orgSlug] = {
        organization: project.organization,
        projects: [project],
      };
    }
    return acc;
  }, {});
};

/**
 * Returns a link to docs on explaining how to manage quotas for that event type
 */
export function getDocsLinkForEventType(
  event: 'error' | 'transaction' | 'attachment' | 'replay'
) {
  switch (event) {
    case 'transaction':
      return 'https://docs.sentry.io/product/performance/transaction-summary/#what-is-a-transaction';
    case 'attachment':
      return 'https://docs.sentry.io/product/accounts/quotas/manage-attachments-quota/#2-rate-limiting';
    case 'replay':
      return 'https://docs.sentry.io/product/session-replay/';
    default:
      return 'https://docs.sentry.io/product/accounts/quotas/manage-event-stream-guide/#common-workflows-for-managing-your-event-stream';
  }
}

/**
 * Returns the corresponding notification type name from the router path name
 */
export function getNotificationTypeFromPathname(routerPathname: string) {
  const result = Object.entries(NOTIFICATION_SETTINGS_PATHNAMES).find(
    ([_, pathname]) => pathname === routerPathname
  ) ?? [routerPathname];
  return result[0];
}

import {DataCategoryExact} from 'sentry/types/core';
import type {OrganizationSummary} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
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
      acc[orgSlug]!.projects.push(project);
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
  event: DataCategoryExact | string // TODO(isabella): get rid of strings after removing need for backward compatibility on gs
) {
  switch (event) {
    case DataCategoryExact.TRANSACTION:
      // For pre-AM3 plans prior to June 11th, 2024
      return 'https://docs.sentry.io/pricing/quotas/legacy-manage-transaction-quota/';
    case DataCategoryExact.SPAN:
    case DataCategoryExact.SPAN_INDEXED:
    case 'span_indexed':
      // For post-AM3 plans after June 11th, 2024
      return 'https://docs.sentry.io/pricing/quotas/manage-transaction-quota/';
    case DataCategoryExact.ATTACHMENT:
      return 'https://docs.sentry.io/product/accounts/quotas/manage-attachments-quota/#2-rate-limiting';
    case DataCategoryExact.REPLAY:
      return 'https://docs.sentry.io/product/session-replay/';
    case DataCategoryExact.MONITOR_SEAT:
      return 'https://docs.sentry.io/product/crons/';
    case DataCategoryExact.PROFILE_DURATION:
      return 'https://docs.sentry.io/product/explore/profiling/';
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

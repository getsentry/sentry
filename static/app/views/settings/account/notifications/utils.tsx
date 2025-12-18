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
export function getPricingDocsLinkForEventType(event: DataCategoryExact) {
  switch (event) {
    case DataCategoryExact.TRANSACTION:
      // For pre-AM3 plans prior to June 11th, 2024
      return 'https://docs.sentry.io/pricing/quotas/legacy-manage-transaction-quota/';
    case DataCategoryExact.SPAN:
    case DataCategoryExact.SPAN_INDEXED:
      // For post-AM3 plans after June 11th, 2024
      return 'https://docs.sentry.io/pricing/quotas/manage-transaction-quota/';
    case DataCategoryExact.ATTACHMENT:
      return 'https://docs.sentry.io/pricing/quotas/manage-attachments-quota/';
    case DataCategoryExact.REPLAY:
      return 'https://docs.sentry.io/pricing/quotas/manage-replay-quota/';
    case DataCategoryExact.MONITOR_SEAT:
    case DataCategoryExact.UPTIME:
      return 'https://docs.sentry.io/pricing/quotas/manage-cron-monitors/';
    case DataCategoryExact.PROFILE_DURATION:
      return 'https://docs.sentry.io/pricing/quotas/manage-continuous-profile-hours/';
    case DataCategoryExact.PROFILE_DURATION_UI:
      return 'https://docs.sentry.io/pricing/quotas/manage-ui-profile-hours/';
    case DataCategoryExact.SEER_USER:
    case DataCategoryExact.SEER_AUTOFIX:
    case DataCategoryExact.SEER_SCANNER:
      return 'https://docs.sentry.io/pricing/quotas/manage-seer-budget/';
    case DataCategoryExact.LOG_BYTE:
    case DataCategoryExact.LOG_ITEM:
      return 'https://docs.sentry.io/pricing/quotas/manage-logs-quota/';
    default:
      return 'https://docs.sentry.io/pricing/quotas/manage-event-stream-guide/';
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

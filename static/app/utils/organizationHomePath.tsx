import type {Organization} from 'sentry/types/organization';

/**
 * The Issues inbox wins when both inboxes are enabled, so the app only ever
 * has one Inbox.
 */
export function getInboxPath(organization: Organization): string | null {
  if (organization.features.includes('issue-inbox')) {
    return `/organizations/${organization.slug}/issues/inbox/`;
  }
  if (organization.features.includes('universal-inbox')) {
    return `/organizations/${organization.slug}/inbox/`;
  }
  return null;
}

/**
 * Where users land when there is no more specific destination, such as loading
 * the app root or leaving settings. The Inbox is home when the organization
 * has one; otherwise the issue list is.
 */
export function getOrganizationHomePath(organization: Organization): string {
  return getInboxPath(organization) ?? `/organizations/${organization.slug}/issues/`;
}

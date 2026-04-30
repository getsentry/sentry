import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {CONVERSATIONS_LANDING_SUB_PATH} from 'sentry/views/explore/conversations/settings';

/**
 * Returns a conversation URL for external use, e.g. telemetry tagging.
 * Uses an org redirect to the production sentry.io URL.
 */
export function getConversationsUrlTag(
  organizationSlug: string,
  conversationId: number | string
): string {
  return `https://sentry.io/organizations/${organizationSlug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/${encodeURIComponent(conversationId)}/`;
}

/**
 * Returns a conversation URL based on the window location and organizationSlug parameter.
 * If the organizationSlug does not match the customer domain of location.origin, it is overridden by the customer domain.
 */
export function getConversationsUrlForNavigation(
  organizationSlug: string,
  conversationId: number | string
): string {
  const basePath = `/organizations/${organizationSlug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/${encodeURIComponent(conversationId)}/`;
  return `${window.location.origin}${normalizeUrl(basePath)}`;
}

import {CONVERSATIONS_LANDING_SUB_PATH} from 'sentry/views/explore/conversations/settings';

/**
 * Returns a conversation URL for external use, e.g. telemetry tagging.
 * Uses an org redirect to the production sentry.io URL.
 * Do not use this for in-app navigation links.
 */
export function getConversationsUrlForExternalUse(
  organizationSlug: string,
  conversationId: number | string
): string {
  return `https://sentry.io/organizations/${organizationSlug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/${encodeURIComponent(conversationId)}/`;
}

import {CONVERSATIONS_LANDING_SUB_PATH} from 'sentry/views/explore/conversations/settings';

export function getConversationsUrl(
  organizationSlug: string,
  conversationId: number | string
): string {
  return `https://sentry.io/organizations/${organizationSlug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/${encodeURIComponent(conversationId)}/`;
}

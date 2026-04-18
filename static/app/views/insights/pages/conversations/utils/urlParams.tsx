import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {CONVERSATIONS_LANDING_SUB_PATH} from 'sentry/views/insights/pages/conversations/settings';

export function getConversationsUrl(
  organizationSlug: string,
  conversationId: number | string
): string {
  const basePath = `/organizations/${organizationSlug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/${encodeURIComponent(conversationId)}/`;
  return `${window.location.origin}${normalizeUrl(basePath)}`;
}

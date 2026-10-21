import {isUUID} from 'sentry/utils/string/isUUID';

/**
 * UUIDs are long and opaque, so show a short prefix; other id formats
 * (e.g. `resp_...`, `slack:1234`) are already short enough.
 */
export function getConversationDisplayId(conversationId: string): string {
  return isUUID(conversationId) ? conversationId.slice(0, 8) : conversationId;
}

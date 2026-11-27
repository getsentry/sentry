import {FILTER_MASK} from 'sentry/constants';
import type {ConversationApiSpan} from 'sentry/views/explore/conversations/hooks/useConversation';
import {TraceItemMetaInfo} from 'sentry/views/explore/utils';
import type {ScrubbingRule} from 'sentry/views/insights/pages/agents/components/scrubbedText';

const USER_FIELDS = ['user.email', 'user.username', 'user.ip', 'user.id'] as const;

export type ConversationUserField = (typeof USER_FIELDS)[number];

export interface ConversationUserIdentity {
  field: ConversationUserField;
  /**
   * The value is what PII scrubbing left, such as "[Filtered]", because every
   * user attribute the spans carry was scrubbed.
   */
  isScrubbed: boolean;
  value: string;
  /** The rule that scrubbed the value, when the span's scrubbing meta names one. */
  scrubbingRule?: ScrubbingRule;
}

export function normalizeUserValue(value: string | null | undefined): string | null {
  if (!value || value.toLowerCase() === 'none') {
    return null;
  }
  return value;
}

/**
 * The conversation's most readable user identifier: email, then username, IP
 * address and ID. A value PII scrubbing changed says nothing about who the user
 * is, so a real value in a later field wins over it; only when every field is
 * scrubbed is the scrubbed value returned.
 */
export function getConversationUserIdentity(
  spans: ConversationApiSpan[]
): ConversationUserIdentity | null {
  let scrubbed: ConversationUserIdentity | null = null;

  for (const span of spans) {
    const metaInfo = span.meta ? new TraceItemMetaInfo(span.meta) : null;
    for (const field of USER_FIELDS) {
      const value = normalizeUserValue(span[field]);
      if (!value) {
        continue;
      }
      const [remark] = metaInfo?.getRemarks(field) ?? [];
      if (!remark && value !== FILTER_MASK) {
        return {field, value, isScrubbed: false};
      }
      scrubbed ??= {
        field,
        value,
        isScrubbed: true,
        scrubbingRule: remark
          ? {ruleId: remark.ruleId, remark: remark.type, projectSlug: span.project}
          : undefined,
      };
    }
  }

  return scrubbed;
}

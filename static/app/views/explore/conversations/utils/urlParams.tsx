import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import type {Conversation} from 'sentry/views/explore/conversations/hooks/useConversations';
import {CONVERSATIONS_LANDING_SUB_PATH} from 'sentry/views/explore/conversations/settings';

const ONE_HOUR_MS = 60 * 60 * 1000;

interface ConversationsUrlOptions {
  end?: string;
  project?: number | string;
  referrer?: string;
  start?: string;
}

/**
 * Returns the in-app path to a conversation's detail view, scoped to a time
 * window around the conversation and the given projects.
 */
export function getConversationDetailUrl(
  orgSlug: string,
  conversation: Conversation,
  projects: number[],
  referrer = 'conversations-table'
): string {
  const basePath = `/organizations/${orgSlug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/${encodeURIComponent(conversation.conversationId)}/`;
  const params = new URLSearchParams();
  if (conversation.startTimestamp) {
    params.set(
      'start',
      new Date(conversation.startTimestamp - ONE_HOUR_MS).toISOString()
    );
  }
  if (conversation.endTimestamp) {
    params.set('end', new Date(conversation.endTimestamp + ONE_HOUR_MS).toISOString());
  }
  for (const project of projects) {
    params.append('project', String(project));
  }
  params.set('referrer', referrer);
  const qs = params.toString();
  return normalizeUrl(qs ? `${basePath}?${qs}` : basePath);
}

/**
 * Returns a conversation URL for external use, e.g. telemetry tagging.
 * Uses an org redirect to the production sentry.io URL.
 * Do not use this for in-app navigation links.
 */
export function getConversationsUrlForExternalUse(
  organizationSlug: string,
  conversationId: number | string,
  options?: ConversationsUrlOptions
): string {
  const base = `https://sentry.io/organizations/${organizationSlug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/${encodeURIComponent(conversationId)}/`;
  const params = new URLSearchParams();
  if (options?.start) {
    params.set('start', options.start);
  }
  if (options?.end) {
    params.set('end', options.end);
  }
  if (options?.project !== undefined) {
    params.set('project', String(options.project));
  }
  if (options?.referrer) {
    params.set('referrer', options.referrer);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

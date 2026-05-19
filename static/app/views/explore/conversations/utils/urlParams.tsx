import {CONVERSATIONS_LANDING_SUB_PATH} from 'sentry/views/explore/conversations/settings';

interface ConversationsUrlOptions {
  end?: string;
  project?: number | string;
  start?: string;
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
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

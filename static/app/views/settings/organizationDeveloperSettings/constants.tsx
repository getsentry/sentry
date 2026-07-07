import type {WebhookEvent} from 'sentry/types/integrations';
import {capitalize} from 'sentry/utils/string/capitalize';

export const EVENT_CHOICES = [
  'issue',
  'error',
  'comment',
  'seer',
  'preprod_artifact',
] as const satisfies readonly WebhookEvent[];

// The subscribable webhook vocabulary, mirroring EVENT_EXPANSION on the
// backend (sentry_apps/utils/webhooks.py). A subscription is a whole resource
// ("issue") or, with granular events enabled, an individual event
// ("issue.created"). Needs to be backwards compatible with old stored
// subscriptions.
export const RESOURCE_EVENTS = {
  issue: [
    'issue.created',
    'issue.resolved',
    'issue.assigned',
    'issue.ignored',
    'issue.unresolved',
  ],
  error: ['error.created'],
  comment: ['comment.created', 'comment.updated', 'comment.deleted'],
  seer: [
    'seer.root_cause_started',
    'seer.root_cause_completed',
    'seer.solution_started',
    'seer.solution_completed',
    'seer.coding_started',
    'seer.coding_completed',
    'seer.pr_created',
    'seer.iteration_started',
    'seer.iteration_completed',
  ],
  preprod_artifact: [
    'preprod_artifact.size_analysis_completed',
    'preprod_artifact.build_distribution_completed',
  ],
} as const satisfies Record<WebhookEvent, readonly string[]>;

export type WebhookGranularEvent = (typeof RESOURCE_EVENTS)[WebhookEvent][number];

export type WebhookSubscription = WebhookEvent | WebhookGranularEvent;

export const WEBHOOK_GRANULAR_EVENT_CHOICES = [
  ...RESOURCE_EVENTS.issue,
  ...RESOURCE_EVENTS.error,
  ...RESOURCE_EVENTS.comment,
  ...RESOURCE_EVENTS.seer,
  ...RESOURCE_EVENTS.preprod_artifact,
] as const;

const LEGACY_EVENT_ALIASES: Record<string, WebhookGranularEvent> = {
  'issue.archived': 'issue.ignored',
};

/** An app's stored subscriptions (`webhookEvents`) mapped onto today's vocabulary. */
export function granularWebhookEvents(webhookEvents: string[]): WebhookGranularEvent[] {
  const known = new Set<string>(WEBHOOK_GRANULAR_EVENT_CHOICES);
  const canonical = webhookEvents.map(event => LEGACY_EVENT_ALIASES[event] ?? event);
  return [...new Set(canonical)].filter((event): event is WebhookGranularEvent =>
    known.has(event)
  );
}

export function resourceOf(subscription: WebhookSubscription): WebhookEvent {
  return subscription.split('.')[0] as WebhookEvent;
}

// Display names the token transform in webhookEventLabel can't produce
const EVENT_LABELS: Partial<Record<WebhookGranularEvent, string>> = {
  'issue.ignored': 'Archived',
  'comment.updated': 'Edited',
  'seer.pr_created': 'PR created',
};

export function webhookEventLabel(event: WebhookGranularEvent): string {
  return EVENT_LABELS[event] ?? capitalize(event.split('.')[1]!.replaceAll('_', ' '));
}

const RESOURCE_LABELS: Record<WebhookEvent, string> = {
  issue: 'Issues',
  error: 'Errors',
  comment: 'Comments',
  seer: 'Seer',
  preprod_artifact: 'Preprod Artifacts',
};

export function webhookResourceLabel(resource: WebhookEvent): string {
  return RESOURCE_LABELS[resource];
}

export const PERMISSIONS_MAP = {
  issue: 'Event',
  error: 'Event',
  comment: 'Event',
  seer: 'Event',
  preprod_artifact: 'Project',
} as const;

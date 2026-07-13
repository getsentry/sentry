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

/** The granular events an app's stored subscriptions cover, whether stored as exact events or whole resources. */
export function granularWebhookEvents(subscriptions: string[]): WebhookGranularEvent[] {
  const stored = new Set<string>(
    subscriptions.map(subscription => LEGACY_EVENT_ALIASES[subscription] ?? subscription)
  );
  for (const resource of EVENT_CHOICES) {
    if (stored.has(resource)) {
      for (const event of RESOURCE_EVENTS[resource]) {
        stored.add(event);
      }
    }
  }
  return WEBHOOK_GRANULAR_EVENT_CHOICES.filter(event => stored.has(event));
}

const EVENT_LABEL_OVERRIDES: Partial<Record<WebhookGranularEvent, string>> = {
  'issue.ignored': 'Archived', // the product renamed ignore → archive
  'comment.updated': 'Edited', // the product renamed update → edit
  'seer.pr_created': 'PR created', // the transform below would render "Pr created"
};

export function webhookEventLabel(event: WebhookGranularEvent): string {
  return (
    EVENT_LABEL_OVERRIDES[event] ??
    capitalize(event.slice(event.indexOf('.') + 1).replaceAll('_', ' '))
  );
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

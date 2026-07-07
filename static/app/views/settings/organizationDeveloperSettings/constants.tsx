import type {WebhookEvent} from 'sentry/types/integrations';

export const EVENT_CHOICES = [
  'issue',
  'error',
  'comment',
  'seer',
  'preprod_artifact',
] as const satisfies readonly WebhookEvent[];

// Mirrors EVENT_EXPANSION on the backend (sentry_apps/utils/webhooks.py)
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

const EVENT_LABEL_OVERRIDES: Partial<Record<WebhookGranularEvent, string>> = {
  'issue.ignored': 'archived', // the product renamed ignore → archive
  'comment.updated': 'edited', // the product renamed update → edit
};

export function webhookEventLabel(event: WebhookGranularEvent): string {
  return EVENT_LABEL_OVERRIDES[event] ?? event.slice(event.indexOf('.') + 1);
}

export const PERMISSIONS_MAP = {
  issue: 'Event',
  error: 'Event',
  comment: 'Event',
  seer: 'Event',
  preprod_artifact: 'Project',
} as const;

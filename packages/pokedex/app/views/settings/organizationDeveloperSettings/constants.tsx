export const EVENT_CHOICES = ['issue', 'error', 'comment'] as const;

export const DESCRIPTIONS = {
  issue: 'created, resolved, assigned, ignored',
  error: 'created',
  comment: 'created, edited, deleted',
} as const;

export const PERMISSIONS_MAP = {
  issue: 'Event',
  error: 'Event',
  comment: 'Event',
} as const;

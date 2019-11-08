export const EVENT_CHOICES = ['issue', 'error'] as const;

export const DESCRIPTIONS = {
  issue: 'created, resolved, assigned',
  error: 'created',
} as const;

export const PERMISSIONS_MAP = {
  issue: 'Event',
  error: 'Event',
} as const;

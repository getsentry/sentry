export const EVENT_CHOICES = ['issue', 'error', 'comment'] as const;

export const PERMISSIONS_MAP = {
  issue: 'Event',
  error: 'Event',
  comment: 'Event',
} as const;

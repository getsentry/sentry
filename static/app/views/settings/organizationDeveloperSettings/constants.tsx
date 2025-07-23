export const EVENT_CHOICES = ['issue', 'error', 'comment', 'seer'] as const;

export const PERMISSIONS_MAP = {
  issue: 'Event',
  error: 'Event',
  comment: 'Event',
  seer: 'Event',
} as const;

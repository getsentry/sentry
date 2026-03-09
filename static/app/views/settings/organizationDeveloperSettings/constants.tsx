export const EVENT_CHOICES = [
  'issue',
  'error',
  'comment',
  'seer',
  'size_analysis',
] as const;

export const PERMISSIONS_MAP = {
  issue: 'Event',
  error: 'Event',
  comment: 'Event',
  seer: 'Event',
  size_analysis: 'Project',
} as const;

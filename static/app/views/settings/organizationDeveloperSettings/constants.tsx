export const EVENT_CHOICES = [
  'issue',
  'error',
  'comment',
  'seer',
  'preprod_artifact',
] as const;

export const PERMISSIONS_MAP = {
  issue: 'Event',
  error: 'Event',
  comment: 'Event',
  seer: 'Event',
  preprod_artifact: 'Project',
} as const;

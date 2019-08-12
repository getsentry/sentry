export const URL_PARAM = {
  START: 'start',
  END: 'end',
  UTC: 'utc',
  PERIOD: 'statsPeriod',
  PROJECT: 'project',
  ENVIRONMENT: 'environment',
} as const;

export const DATE_TIME = {
  START: 'start',
  END: 'end',
  PERIOD: 'period',
  UTC: 'utc',
} as const;

export const DATE_TIME_KEYS = Object.values(DATE_TIME);

export const LOCAL_STORAGE_KEY = 'global-selection';

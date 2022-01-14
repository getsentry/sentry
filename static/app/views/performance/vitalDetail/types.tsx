import EventView from 'sentry/utils/discover/eventView';

const VIEW_QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;

export type ViewProps = Pick<EventView, typeof VIEW_QUERY_KEYS[number]>;

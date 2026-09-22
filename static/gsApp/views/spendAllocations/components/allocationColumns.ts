import type {TableColumnConfig} from '@sentry/scraps/table';

export const ALLOCATION_COLUMNS = {
  project: {key: 'project', width: 'minmax(160px, 1fr)'},
  allocatedLabel: {key: 'allocated-label', width: 120},
  allocatedValues: {key: 'allocated-values', width: 180},
  consumedLabel: {key: 'consumed-label', width: 120},
  consumedValues: {key: 'consumed-values', width: 180},
  actions: {key: 'actions', width: 100},
} satisfies Record<string, TableColumnConfig>;

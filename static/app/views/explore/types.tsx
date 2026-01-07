import type {Project} from 'sentry/types/project';

export enum TraceItemDataset {
  LOGS = 'logs',
  SPANS = 'spans',
  UPTIME_RESULTS = 'uptime_results',
  TRACEMETRICS = 'tracemetrics',
  PREPROD = 'preprod',
}

export interface UseTraceItemAttributeBaseProps {
  /**
   * The trace item type supported by the endpoint, currently only supports LOGS.
   */
  traceItemType: TraceItemDataset;
  /**
   * The attribute type supported by the endpoint, currently only supports string and number.
   */
  type: 'number' | 'string';
  /**
   * Optional list of projects to search. If not provided, it'll use the page filters.
   */
  projects?: Project[];
}

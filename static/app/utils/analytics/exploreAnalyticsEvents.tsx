import type {Organization} from 'sentry/types/organization';
import type {TraceItemDataset} from 'sentry/views/explore/types';

export type ExploreAnalyticsEventParameters = {
  'explore.floating_trigger.clear_selection': {
    organization: Organization;
  };
  'explore.floating_trigger.compare_attribute_breakdowns': {
    organization: Organization;
  };
  'explore.floating_trigger.zoom_in': {
    organization: Organization;
  };
  'explore.table_exported': {
    export_type: 'browser_sync' | 'export_download';
    field: string[];
    organization: Organization;
    query: string;
    sort: string[];
    traceItemDataset: TraceItemDataset;
    end?: string;
    environment?: string[];
    export_file_format?: 'csv' | 'jsonl';
    export_row_limit?: number;
    start?: string;
    statsPeriod?: string;
  };
};

type ExploreAnalyticsEventKey = keyof ExploreAnalyticsEventParameters;

export const exploreAnalyticsEventMap: Record<ExploreAnalyticsEventKey, string | null> = {
  'explore.floating_trigger.clear_selection': 'Explore: Floating Trigger Clear Selection',
  'explore.floating_trigger.compare_attribute_breakdowns':
    'Explore: Floating Trigger Compare Attribute Breakdowns',
  'explore.floating_trigger.zoom_in': 'Explore: Floating Trigger Zoom In',
  'explore.table_exported': 'Explore: Table Exported',
};

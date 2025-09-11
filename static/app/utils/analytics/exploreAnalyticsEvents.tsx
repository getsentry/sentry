import type {Organization} from 'sentry/types/organization';
import type {TraceItemDataset} from 'sentry/views/explore/types';

export type ExploreAnalyticsEventParameters = {
  'explore.table_exported': {
    export_type: 'browser_csv' | 'download';
    field: string[];
    organization: Organization;
    query: string;
    sort: string[];
    traceItemDataset: TraceItemDataset;
    end?: string;
    environment?: string[];
    start?: string;
    statsPeriod?: string;
  };
};

type ExploreAnalyticsEventKey = keyof ExploreAnalyticsEventParameters;

export const exploreAnalyticsEventMap: Record<ExploreAnalyticsEventKey, string | null> = {
  'explore.table_exported': 'Explore: Table Exported',
};

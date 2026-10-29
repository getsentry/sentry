import type {Organization} from 'sentry/types/organization';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {TraceItemDataset} from 'sentry/views/explore/types';

type TransformationAnalyticsContext = {
  organization: Organization;
  traceItemDataset:
    | TraceItemDataset.SPANS
    | TraceItemDataset.LOGS
    | TraceItemDataset.TRACEMETRICS;
  transformation_index: number;
};

type TransformationType = 'fill' | 'smooth';

export type ExploreAnalyticsEventParameters = {
  'explore.dropped_data.ask_seer_clicked': {
    dataset: DiscoverDatasets;
    organization: Organization;
    outcome: string;
    reason: string;
  };
  'explore.dropped_data.drawer_opened': {
    dataset: DiscoverDatasets;
    organization: Organization;
  };
  'explore.dropped_data.legend_outcome_toggled': {
    dataset: DiscoverDatasets;
    organization: Organization;
    outcome: string;
    selected: boolean;
  };
  'explore.dropped_data.scope_toggled': {
    dataset: DiscoverDatasets;
    organization: Organization;
    scope: 'unexpected' | 'all';
  };
  'explore.floating_trigger.clear_selection': {
    organization: Organization;
  };
  'explore.floating_trigger.compare_attribute_breakdowns': {
    organization: Organization;
  };
  'explore.floating_trigger.zoom_in': {
    organization: Organization;
  };
  'explore.share_link_copied': {
    frozen_relative_period: boolean;
    organization: Organization;
    traceItemDataset: TraceItemDataset;
  };
  'explore.table_exported': {
    export_type: 'browser_sync' | 'export_download';
    organization: Organization;
    query: string;
    sort: string[];
    traceItemDataset: TraceItemDataset;
    end?: string;
    environment?: string[];
    export_file_format?: 'csv' | 'jsonl';
    export_row_limit?: number;
    field?: string[];
    project?: number[];
    start?: string;
    statsPeriod?: string;
    statsPeriodEnd?: string;
    statsPeriodStart?: string;
  };
  'explore.visualize.transformation.added': TransformationAnalyticsContext & {
    transformation_type: TransformationType;
  };
  'explore.visualize.transformation.factor_changed': TransformationAnalyticsContext & {
    factor: number | null;
  };
  'explore.visualize.transformation.method_changed': TransformationAnalyticsContext &
    (
      | {method: 'zero' | 'locf' | 'linear'; transformation_type: 'fill'}
      | {method: 'sma' | 'ema' | 'asap'; transformation_type: 'smooth'}
    );
  'explore.visualize.transformation.removed': TransformationAnalyticsContext & {
    transformation_type: TransformationType | 'unsupported';
  };
  'explore.visualize.transformation.reordered': TransformationAnalyticsContext & {
    target_index: number;
    target_type: TransformationType;
    transformation_type: TransformationType;
  };
  'explore.visualize.transformation.type_changed': TransformationAnalyticsContext & {
    previous_type: TransformationType;
    transformation_type: TransformationType;
  };
  'explore.visualize.transformation.window_changed': TransformationAnalyticsContext & {
    method: 'sma' | 'ema' | 'asap';
    window: number | null;
  };
};

type ExploreAnalyticsEventKey = keyof ExploreAnalyticsEventParameters;

export const exploreAnalyticsEventMap = {
  'explore.dropped_data.ask_seer_clicked': 'Explore: Dropped Data Ask Seer Clicked',
  'explore.dropped_data.drawer_opened': 'Explore: Dropped Data Drawer Opened',
  'explore.dropped_data.legend_outcome_toggled':
    'Explore: Dropped Data Legend Outcome Toggled',
  'explore.dropped_data.scope_toggled': 'Explore: Dropped Data Scope Toggled',
  'explore.floating_trigger.clear_selection': 'Explore: Floating Trigger Clear Selection',
  'explore.floating_trigger.compare_attribute_breakdowns':
    'Explore: Floating Trigger Compare Attribute Breakdowns',
  'explore.floating_trigger.zoom_in': 'Explore: Floating Trigger Zoom In',
  'explore.share_link_copied': 'Explore: Share Link Copied',
  'explore.table_exported': 'Explore: Table Exported',
  'explore.visualize.transformation.added': 'Explore: Visualize Transformation Added',
  'explore.visualize.transformation.factor_changed':
    'Explore: Visualize Transformation Factor Changed',
  'explore.visualize.transformation.method_changed':
    'Explore: Visualize Transformation Method Changed',
  'explore.visualize.transformation.removed': 'Explore: Visualize Transformation Removed',
  'explore.visualize.transformation.reordered':
    'Explore: Visualize Transformation Reordered',
  'explore.visualize.transformation.type_changed':
    'Explore: Visualize Transformation Type Changed',
  'explore.visualize.transformation.window_changed':
    'Explore: Visualize Transformation Window Changed',
} satisfies Record<ExploreAnalyticsEventKey, string | null>;

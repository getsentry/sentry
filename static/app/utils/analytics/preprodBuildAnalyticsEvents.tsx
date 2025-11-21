import type {Organization} from 'sentry/types/organization';

import makeAnalyticsFunction from './makeAnalyticsFunction';

type BasePreprodBuildEvent = {
  organization: Organization;
  base_id?: string;
  build_id?: string;
  head_id?: string;
  platform?: string | null;
  project_slug?: string;
  project_type?: string | null;
};

export type PreprodBuildEventParameters = {
  'preprod.builds.compare_build_clicked': BasePreprodBuildEvent & {
    slot?: 'head' | 'base';
  };
  'preprod.builds.compare_build_selected': BasePreprodBuildEvent;
  'preprod.builds.compare_selection_viewed': BasePreprodBuildEvent;
  'preprod.builds.compare_state_viewed': BasePreprodBuildEvent;
  'preprod.builds.compare_trigger_clicked': BasePreprodBuildEvent;
  'preprod.builds.details_compare_clicked': BasePreprodBuildEvent;
  'preprod.builds.details_delete_clicked': BasePreprodBuildEvent;
  'preprod.builds.details_insight_action_clicked': BasePreprodBuildEvent & {
    insight_key: string;
  };
  'preprod.builds.details_insight_expanded': BasePreprodBuildEvent & {
    insight_key: string;
    insight_name?: string;
  };
  'preprod.builds.details_insights_opened': BasePreprodBuildEvent & {
    insight_count?: number;
    source?: string;
  };
  'preprod.builds.details_viewed': BasePreprodBuildEvent;
  'preprod.builds.release_row_clicked': BasePreprodBuildEvent;
  'preprod.builds.release_tab_viewed': BasePreprodBuildEvent & {
    has_results?: boolean;
  };
};

type PreprodBuildAnalyticsKey = keyof PreprodBuildEventParameters;

export const preprodBuildEventMap: Record<PreprodBuildAnalyticsKey, string | null> = {
  'preprod.builds.release_tab_viewed': 'Preprod Builds: Release Tab Viewed',
  'preprod.builds.release_row_clicked': 'Preprod Builds: Release Row Clicked',
  'preprod.builds.details_viewed': 'Preprod Build Details: Viewed',
  'preprod.builds.details_insights_opened': 'Preprod Build Details: Insights Opened',
  'preprod.builds.details_insight_expanded': 'Preprod Build Details: Insight Expanded',
  'preprod.builds.details_insight_action_clicked':
    'Preprod Build Details: Insight Action Clicked',
  'preprod.builds.details_compare_clicked': 'Preprod Build Details: Compare Clicked',
  'preprod.builds.details_delete_clicked': 'Preprod Build Details: Delete Clicked',
  'preprod.builds.compare_selection_viewed': 'Preprod Build Comparison: Selection Viewed',
  'preprod.builds.compare_state_viewed': 'Preprod Build Comparison: Compare View Viewed',
  'preprod.builds.compare_build_clicked': 'Preprod Build Comparison: Build Clicked',
  'preprod.builds.compare_build_selected': 'Preprod Build Comparison: Base Selected',
  'preprod.builds.compare_trigger_clicked': 'Preprod Build Comparison: Compare Triggered',
};

export const trackPreprodBuildAnalytics =
  makeAnalyticsFunction<PreprodBuildEventParameters>(preprodBuildEventMap);

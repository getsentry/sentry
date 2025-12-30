import type {Organization} from 'sentry/types/organization';

type BasePreprodBuildEvent = {
  organization: Organization;
  build_id?: string;
  platform?: string | null;
  project_slug?: string;
  project_type?: string | null;
};

type BuildListPageSource =
  | 'preprod_builds_list'
  | 'releases_mobile_builds_tab'
  | 'releases_details_preprod_builds';

type BuildListDisplay = 'size' | 'distribution';

export type PreprodBuildEventParameters = {
  'preprod.builds.compare.go_to_build_details': BasePreprodBuildEvent & {
    slot?: 'head' | 'base';
  };
  'preprod.builds.compare.select_base_build': BasePreprodBuildEvent;
  'preprod.builds.compare.trigger_comparison': BasePreprodBuildEvent;
  'preprod.builds.details.compare_build_clicked': BasePreprodBuildEvent;
  'preprod.builds.details.delete_build': BasePreprodBuildEvent;
  'preprod.builds.details.expand_insight': BasePreprodBuildEvent & {
    insight_key: string;
  };
  'preprod.builds.details.open_insight_details_modal': BasePreprodBuildEvent & {
    insight_key: string;
  };
  'preprod.builds.details.open_insights_sidebar': BasePreprodBuildEvent & {
    source: 'metric_card' | 'insight_table';
  };
  'preprod.builds.install_modal.opened': BasePreprodBuildEvent & {
    source: 'build_details_sidebar' | 'builds_table';
  };
  'preprod.builds.list.metadata': BasePreprodBuildEvent & {
    builds_page_count: number;
    builds_total_count: number;
    datetime_selection: string;
    display: BuildListDisplay;
    has_search_query: boolean;
    is_empty: boolean;
    page_source: BuildListPageSource;
    per_page: number;
    project_count: number;
    query_status: 'success' | 'error';
    cursor?: string | null;
  };
  'preprod.builds.release.build_row_clicked': BasePreprodBuildEvent;
  'preprod.releases.mobile-builds.tab-clicked': {
    organization: Organization;
  };
};

type PreprodBuildAnalyticsKey = keyof PreprodBuildEventParameters;

export const preprodBuildEventMap: Record<PreprodBuildAnalyticsKey, string | null> = {
  'preprod.builds.list.metadata': 'Preprod Builds: List Metadata',
  'preprod.builds.release.build_row_clicked': 'Preprod Builds: Release Build Row Clicked',
  'preprod.builds.details.open_insights_sidebar':
    'Preprod Build Details: Insights Sidebar Opened',
  'preprod.builds.details.expand_insight': 'Preprod Build Details: Insight Expanded',
  'preprod.builds.details.open_insight_details_modal':
    'Preprod Build Details: Open Insight Details Modal',
  'preprod.builds.details.delete_build': 'Preprod Build Details: Delete Build',
  'preprod.builds.details.compare_build_clicked':
    'Preprod Build Details: Compare Clicked',
  'preprod.builds.compare.go_to_build_details':
    'Preprod Build Comparison: Go to Build Details',
  'preprod.builds.compare.select_base_build': 'Preprod Build Comparison: Base Selected',
  'preprod.builds.compare.trigger_comparison':
    'Preprod Build Comparison: Compare Triggered',
  'preprod.builds.install_modal.opened': 'Preprod Builds: Install Modal Opened',
  'preprod.releases.mobile-builds.tab-clicked':
    'Preprod Releases: Mobile Builds Tab Clicked',
};

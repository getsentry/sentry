import type {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import type {Organization} from 'sentry/types/organization';
import type {ArtifactType} from 'sentry/views/settings/project/preprod/types';

type BasePreprodBuildEvent = {
  organization: Organization;
  build_id?: string;
  platform?: string | null;
  project_slug?: string;
  project_type?: string | null;
};

type PreprodSettingsEvent = {
  organization: Organization;
  project_slug: string;
};

export type BuildListPageSource =
  | 'preprod_builds_list'
  | 'releases_mobile_builds_tab'
  | 'releases_snapshots_tab'
  | 'releases_details_preprod_builds';

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
  'preprod.builds.list.metadata': {
    build_count_on_page: number;
    datetime_selection: string;
    display: PreprodBuildsDisplay;
    has_search_query: boolean;
    is_empty: boolean;
    organization: Organization;
    page_source: BuildListPageSource;
    project_count: number;
    query_status: 'success' | 'error';
    cursor?: string | null;
  };
  'preprod.builds.onboarding.docs_clicked': {
    link_type: 'product' | 'ios' | 'android' | 'flutter' | 'react-native';
    organization: Organization;
    platform: string | undefined;
  };
  'preprod.builds.onboarding.viewed': {
    organization: Organization;
    platform: string | undefined;
    project_id: string;
  };
  'preprod.builds.release.build_row_clicked': BasePreprodBuildEvent;
  'preprod.releases.mobile-builds.tab-clicked': {
    organization: Organization;
  };
  'preprod.releases.snapshots.tab-clicked': {
    organization: Organization;
  };
  'preprod.settings.status_check_rule_created': PreprodSettingsEvent;
  'preprod.settings.status_check_rule_deleted': PreprodSettingsEvent;
  'preprod.settings.status_check_rule_updated': PreprodSettingsEvent & {
    artifact_type: ArtifactType;
    measurement: string;
    metric: string;
    value: number;
  };
  'preprod.snapshots.details.approve_clicked': {
    build_id: string;
    organization: Organization;
  };
  'preprod.snapshots.details.diff_mode_changed': {
    diff_mode: string;
    organization: Organization;
  };
  'preprod.snapshots.details.image_link_copied': {
    diff_status: string | null;
    organization: Organization;
  };
  'preprod.snapshots.details.image_metadata_copied': {
    diff_status: string | null;
    organization: Organization;
  };
  'preprod.snapshots.details.view_mode_changed': {
    organization: Organization;
    view_mode: string;
  };
  'preprod.snapshots.details.viewed': {
    approval_status: string | null;
    comparison_type: string;
    has_base_build: boolean;
    image_count: number;
    organization: Organization;
    project_id: string;
  };
  'preprod.snapshots.list.row_clicked': BasePreprodBuildEvent & {
    approval_status?: string | null;
    comparison_state?: string | null;
    image_count?: number;
    images_added?: number;
    images_changed?: number;
    images_removed?: number;
    images_unchanged?: number;
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
  'preprod.builds.onboarding.viewed': 'Preprod Builds: Onboarding Viewed',
  'preprod.builds.onboarding.docs_clicked': 'Preprod Builds: Onboarding Docs Clicked',
  'preprod.releases.mobile-builds.tab-clicked':
    'Preprod Releases: Mobile Builds Tab Clicked',
  'preprod.releases.snapshots.tab-clicked': 'Preprod Releases: Snapshots Tab Clicked',
  'preprod.snapshots.list.row_clicked': 'Preprod Snapshots: List Row Clicked',
  'preprod.snapshots.details.viewed': 'Preprod Snapshots: Details Viewed',
  'preprod.snapshots.details.approve_clicked': 'Preprod Snapshots: Approve Clicked',
  'preprod.snapshots.details.image_link_copied': 'Preprod Snapshots: Image Link Copied',
  'preprod.snapshots.details.image_metadata_copied':
    'Preprod Snapshots: Image Metadata Copied',
  'preprod.snapshots.details.view_mode_changed': 'Preprod Snapshots: View Mode Changed',
  'preprod.snapshots.details.diff_mode_changed': 'Preprod Snapshots: Diff Mode Changed',
  'preprod.settings.status_check_rule_created':
    'Preprod Settings: Status Check Rule Created',
  'preprod.settings.status_check_rule_deleted':
    'Preprod Settings: Status Check Rule Deleted',
  'preprod.settings.status_check_rule_updated':
    'Preprod Settings: Status Check Rule Updated',
};

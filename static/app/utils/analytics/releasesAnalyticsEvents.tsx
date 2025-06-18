import type {ReleaseComparisonChartType} from 'sentry/types/release';

export type ReleasesEventParameters = {
  'releases.bubbles_legend': {selected: boolean};
  'releases.change_chart_type': {chartType: ReleaseComparisonChartType};
  'releases.drawer_opened': {organization: string; source: string; release?: boolean};
  'releases.drawer_view_full_details': {project_id: string};
  'releases.quickstart_copied': {project_id: string};
  'releases.quickstart_create_integration.success': {
    integration_uuid: string;
    project_id: string;
  };
  'releases.quickstart_create_integration_modal.close': {project_id: string};
  'releases.quickstart_viewed': {project_id: string};
};

type ReleasesEventKey = keyof ReleasesEventParameters;

export const releasesEventMap: Record<ReleasesEventKey, string | null> = {
  'releases.bubbles_legend': 'Releases: Toggle Legend for Bubble',
  'releases.change_chart_type': 'Releases: Change Chart Type',
  'releases.drawer_view_full_details': 'Releases: Drawer View Full Details',
  'releases.drawer_opened': 'Releases: Drawer Opened',
  'releases.quickstart_viewed': 'Releases: Quickstart Viewed',
  'releases.quickstart_copied': 'Releases: Quickstart Copied',
  'releases.quickstart_create_integration.success':
    'Releases: Quickstart Created Integration',
  'releases.quickstart_create_integration_modal.close':
    'Releases: Quickstart Create Integration Modal Exit',
};

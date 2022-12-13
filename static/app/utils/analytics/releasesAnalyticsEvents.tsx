import {ReleaseComparisonChartType} from 'sentry/types';

export type ReleasesEventParameters = {
  'releases.change_chart_type': {chartType: ReleaseComparisonChartType};
  'releases.quickstart_copied': {project_id: string};
  'releases.quickstart_create_integration.success': {
    integration_uuid: string;
    project_id: string;
  };
  'releases.quickstart_create_integration_modal.close': {project_id: string};
  'releases.quickstart_viewed': {project_id: string};
};

export type ReleasesEventKey = keyof ReleasesEventParameters;

export const releasesEventMap: Record<ReleasesEventKey, string | null> = {
  'releases.quickstart_viewed': 'Releases: Quickstart Viewed',
  'releases.quickstart_copied': 'Releases: Quickstart Copied',
  'releases.quickstart_create_integration.success':
    'Releases: Quickstart Created Integration',
  'releases.quickstart_create_integration_modal.close':
    'Releases: Quickstart Create Integration Modal Exit',
  'releases.change_chart_type': 'Releases: Change Chart Type',
};

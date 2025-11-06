import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';

export type MetricsAnalyticsEventParameters = {
  'metrics.explorer.setup_button_clicked': {
    organization: Organization;
    platform: PlatformKey | 'unknown';
    supports_onboarding_checklist: boolean;
  };
  'metrics.nav.rendered': {
    metrics_tab_visible: boolean;
    organization: Organization;
    platforms: Array<PlatformKey | 'unknown'>;
  };
  'metrics.onboarding': {
    organization: Organization;
    platform: PlatformKey | 'unknown';
    supports_onboarding_checklist: boolean;
  };
  'metrics.onboarding_platform_docs_viewed': {
    organization: Organization;
    platform: PlatformKey | 'unknown';
  };
  'metrics.save_as': {
    organization: Organization;
    save_type: 'alert' | 'dashboard' | 'update_query';
    ui_source: string;
  };
  'metrics.save_query_modal': {
    action: 'open';
    organization: Organization;
    save_type: 'save_new_query';
    ui_source: string;
  };
};

type MetricsAnalyticsEventKey = keyof MetricsAnalyticsEventParameters;

export const metricsAnalyticsEventMap: Record<MetricsAnalyticsEventKey, string | null> = {
  'metrics.explorer.setup_button_clicked': 'Metrics Setup Button Clicked',
  'metrics.nav.rendered': 'Metrics Nav Rendered',
  'metrics.onboarding': 'Metrics Explore Empty State (Onboarding)',
  'metrics.onboarding_platform_docs_viewed':
    'Metrics Explore Empty State (Onboarding) - Platform Docs Viewed',
  'metrics.save_as': 'Metrics Save As',
  'metrics.save_query_modal': 'Metrics Save Query Modal',
};

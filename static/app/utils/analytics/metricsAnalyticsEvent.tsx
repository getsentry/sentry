import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';

export enum MetricsAnalyticsPageSource {
  EXPLORE_METRICS = 'explore',
  ISSUE_DETAILS = 'issue details',
  TRACE_DETAILS = 'trace details',
}

export type MetricsAnalyticsEventParameters = {
  'metrics.explorer.setup_button_clicked': {
    organization: Organization;
    platform: PlatformKey | 'unknown';
    supports_onboarding_checklist: boolean;
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
};

type MetricsAnalyticsEventKey = keyof MetricsAnalyticsEventParameters;

export const metricsAnalyticsEventMap: Record<MetricsAnalyticsEventKey, string | null> = {
  'metrics.explorer.setup_button_clicked': 'Metrics Setup Button Clicked',
  'metrics.onboarding': 'Metrics Explore Empty State (Onboarding)',
  'metrics.onboarding_platform_docs_viewed':
    'Metrics Explore Empty State (Onboarding) - Platform Docs Viewed',
};

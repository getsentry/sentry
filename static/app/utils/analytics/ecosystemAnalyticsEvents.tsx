import type {PlatformKey} from 'sentry/types';
import type {BaseEventAnalyticsParams} from 'sentry/utils/analytics/workflowAnalyticsEvents';

type SetupType = 'automatic' | 'manual';
type StackTraceView = 'stacktrace_issue_details' | 'integration_configuration_detail';

export type EcosystemEventParameters = {
  'integrations.stacktrace_codecov_link_clicked': {
    group_id: number;
    view: StackTraceView;
  } & BaseEventAnalyticsParams;
  'integrations.stacktrace_complete_setup': {
    provider: string;
    setup_type: SetupType;
    view: StackTraceView;
    is_suggestion?: boolean;
  };
  'integrations.stacktrace_docs_clicked': {
    provider: string;
    view: StackTraceView;
  };
  'integrations.stacktrace_link_clicked': {
    group_id: number;
    provider: string;
    view: StackTraceView;
  } & BaseEventAnalyticsParams;
  'integrations.stacktrace_link_cta_dismissed': {
    view: StackTraceView;
  } & BaseEventAnalyticsParams;
  'integrations.stacktrace_manual_option_clicked': {
    provider: string;
    setup_type: SetupType;
    view: StackTraceView;
  };
  'integrations.stacktrace_start_setup': {
    provider: string;
    setup_type: SetupType;
    view: StackTraceView;
    platform?: PlatformKey;
    // BaseEventAnalyticsParams partial because it is not always present
  } & Partial<BaseEventAnalyticsParams>;
  'integrations.stacktrace_submit_config': {
    provider: string;
    setup_type: SetupType;
    view: StackTraceView;
  };
};

type EcosystemEventKeys = keyof EcosystemEventParameters;

export const ecosystemEventMap: Record<EcosystemEventKeys, string | null> = {
  'integrations.stacktrace_complete_setup': 'Integrations: Stacktrace Complete Setup',
  'integrations.stacktrace_docs_clicked': 'Integrations: Stacktrace Docs Clicked',
  'integrations.stacktrace_link_clicked': 'Integrations: Stacktrace Link Clicked',
  'integrations.stacktrace_link_cta_dismissed':
    'Integrations: Stacktrace Link CTA Dismissed',
  'integrations.stacktrace_manual_option_clicked':
    'Integrations: Stacktrace Manual Option Clicked',
  'integrations.stacktrace_start_setup': 'Integrations: Stacktrace Start Setup',
  'integrations.stacktrace_submit_config': 'Integrations: Stacktrace Submit Config',
  'integrations.stacktrace_codecov_link_clicked':
    'Integrations: Stacktrace Codecov Link Clicked',
};

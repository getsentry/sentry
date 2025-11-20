import type {PlatformKey} from 'sentry/types/project';
import type {BaseEventAnalyticsParams} from 'sentry/utils/analytics/workflowAnalyticsEvents';
import type {DataForwarderProviderSlug} from 'sentry/views/settings/organizationDataForwarding/util/types';

type SetupType = 'automatic' | 'manual';
type StackTraceView = 'stacktrace_issue_details' | 'integration_configuration_detail';

export type EcosystemEventParameters = {
  'data_forwarding.add_forwarder_clicked': Record<string, unknown>;
  'data_forwarding.back_button_clicked': Record<string, unknown>;
  'data_forwarding.delete_cancelled': {
    provider?: DataForwarderProviderSlug;
  };
  'data_forwarding.delete_confirmed': {
    provider?: DataForwarderProviderSlug;
  };
  'data_forwarding.docs_link_clicked': Record<string, unknown>;
  'data_forwarding.edit_clicked': Record<string, unknown>;
  'data_forwarding.edit_complete': {
    are_new_projects_enrolled: boolean;
    new_project_count: number;
    old_project_count: number;
    provider?: DataForwarderProviderSlug;
  };
  'data_forwarding.edit_override_complete': {
    platform?: PlatformKey;
    provider?: DataForwarderProviderSlug;
  };
  'data_forwarding.onboarding_cta_clicked': Record<string, unknown>;
  'data_forwarding.setup_complete': {
    are_new_projects_enrolled: boolean;
    project_count: number;
    provider?: DataForwarderProviderSlug;
  };
  'integrations.non_inapp_stacktrace_link_clicked': {
    group_id: number;
    provider: string;
    view: StackTraceView;
  } & BaseEventAnalyticsParams;
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
  'data_forwarding.add_forwarder_clicked': 'Data Forwarding: Add Forwarder Clicked',
  'data_forwarding.back_button_clicked': 'Data Forwarding: Back Button Clicked',
  'data_forwarding.delete_cancelled': 'Data Forwarding: Deletion Cancelled',
  'data_forwarding.delete_confirmed': 'Data Forwarding: Deletion Confirmed',
  'data_forwarding.docs_link_clicked': 'Data Forwarding: Docs Link Clicked',
  'data_forwarding.edit_clicked': 'Data Forwarding: Edit Clicked',
  'data_forwarding.edit_complete': 'Data Forwarding: Edit Complete',
  'data_forwarding.edit_override_complete': 'Data Forwarding: Edit Override Complete',
  'data_forwarding.onboarding_cta_clicked': 'Data Forwarding: Onboarding CTA Clicked',
  'data_forwarding.setup_complete': 'Data Forwarding: Setup Complete',
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
  'integrations.non_inapp_stacktrace_link_clicked':
    'Integrations: Non-InApp Stacktrace Link Clicked',
};

import {StacktraceErrorMessage} from 'sentry/components/events/interfaces/frame/stacktraceLink';
import {PlatformType} from 'sentry/types';

import {IntegrationView} from './index';

export enum StacktraceLinkEvents {
  'integrations.reconfigure_stacktrace_setup' = 'Integrations: Reconfigure Stacktrace Setup',
  'integrations.stacktrace_complete_setup' = 'Integrations: Stacktrace Complete Setup',
  'integrations.stacktrace_docs_clicked' = 'Integrations: Stacktrace Docs Clicked',
  'integrations.stacktrace_link_clicked' = 'Integrations: Stacktrace Link Clicked',
  'integrations.stacktrace_link_cta_dismissed' = 'Integrations: Stacktrace Link CTA Dismissed',
  'integrations.stacktrace_manual_option_clicked' = 'Integrations: Stacktrace Manual Option Clicked',
  'integrations.stacktrace_start_setup' = 'Integrations: Stacktrace Start Setup',
  'integrations.stacktrace_submit_config' = 'Integrations: Stacktrace Submit Config',
}

type StacktraceLinkEventParams = {
  error_reason?: StacktraceErrorMessage;
  platform?: PlatformType;
  provider?: string;
  setup_type?: 'automatic' | 'manual';
} & IntegrationView;

export type StacktraceLinkEventParameters = {
  [key in keyof typeof StacktraceLinkEvents]: StacktraceLinkEventParams;
};

import type {StacktraceErrorMessage} from 'sentry/types';
import {PlatformType} from 'sentry/types';
import {BaseEventAnalyticsParams} from 'sentry/utils/analytics/workflowAnalyticsEvents';

import {IntegrationView} from './index';

export enum StacktraceLinkEvents {
  COMPLETE_SETUP = 'integrations.stacktrace_complete_setup',
  OPEN_DOCS = 'integrations.stacktrace_docs_clicked',
  OPEN_LINK = 'integrations.stacktrace_link_clicked',
  DISMISS_CTA = 'integrations.stacktrace_link_cta_dismissed',
  MANUAL_OPTION = 'integrations.stacktrace_manual_option_clicked',
  START_SETUP = 'integrations.stacktrace_start_setup',
  SUBMIT = 'integrations.stacktrace_submit_config',
  LINK_VIEWED = 'integrations.stacktrace_link_viewed',
  CODECOV_LINK_CLICKED = 'integrations.stacktrace_codecov_link_clicked',
}

// This type allows analytics functions to use the string literal or enum.KEY
type StacktraceLinkEventsLiterals = `${StacktraceLinkEvents}`;

export type StacktraceLinkEventParameters = {
  [key in StacktraceLinkEventsLiterals]: {
    error_reason?: StacktraceErrorMessage;
    is_suggestion?: boolean;
    platform?: PlatformType;
    project_id?: string;
    provider?: string;
    setup_type?: 'automatic' | 'manual';
    state?: 'match' | 'no_match' | 'prompt' | 'empty';
  } & IntegrationView &
    Partial<BaseEventAnalyticsParams>; // make optional
};

export const stacktraceLinkEventMap: Record<StacktraceLinkEventsLiterals, string> = {
  [StacktraceLinkEvents.COMPLETE_SETUP]: 'Integrations: Stacktrace Complete Setup',
  [StacktraceLinkEvents.OPEN_DOCS]: 'Integrations: Stacktrace Docs Clicked',
  [StacktraceLinkEvents.OPEN_LINK]: 'Integrations: Stacktrace Link Clicked',
  [StacktraceLinkEvents.LINK_VIEWED]: 'Integrations: Stacktrace Link Viewed',
  [StacktraceLinkEvents.DISMISS_CTA]: 'Integrations: Stacktrace Link CTA Dismissed',
  [StacktraceLinkEvents.MANUAL_OPTION]: 'Integrations: Stacktrace Manual Option Clicked',
  [StacktraceLinkEvents.START_SETUP]: 'Integrations: Stacktrace Start Setup',
  [StacktraceLinkEvents.SUBMIT]: 'Integrations: Stacktrace Submit Config',
  [StacktraceLinkEvents.CODECOV_LINK_CLICKED]:
    'Integrations: Stacktrace Codecov Link Clicked',
};

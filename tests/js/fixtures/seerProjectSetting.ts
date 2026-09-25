import {CodingAgentProvider} from 'sentry/components/events/autofix/types';
import type {SeerProjectSettingResponse} from 'sentry/utils/seer/types';

export function SeerProjectSettingFixture(
  params: Partial<SeerProjectSettingResponse> = {}
): SeerProjectSettingResponse {
  return {
    agent: 'seer',
    autoCreatePr: false,
    automationTuning: 'medium',
    integrationId: null,
    projectId: '2',
    projectSlug: 'checkout-api',
    reposCount: 2,
    scannerAutomation: true,
    stoppingPoint: 'solution',
    ...params,
  };
}

export function SeerProjectSettingsListFixture(): SeerProjectSettingResponse[] {
  return [
    SeerProjectSettingFixture(),
    SeerProjectSettingFixture({
      projectId: '3',
      projectSlug: 'storefront-web',
      reposCount: 1,
      stoppingPoint: 'root_cause',
    }),
    SeerProjectSettingFixture({
      projectId: '4',
      projectSlug: 'payments-worker',
      reposCount: 3,
      agent: CodingAgentProvider.CLAUDE_CODE_AGENT,
      integrationId: '1001',
      stoppingPoint: 'open_pr',
      autoCreatePr: true,
    }),
    SeerProjectSettingFixture({
      projectId: '5',
      projectSlug: 'mobile-ios',
      reposCount: 1,
      stoppingPoint: 'off',
      automationTuning: 'off',
      scannerAutomation: false,
    }),
    SeerProjectSettingFixture({
      projectId: '6',
      projectSlug: 'mobile-android',
      reposCount: 1,
      stoppingPoint: 'code_changes',
    }),
    SeerProjectSettingFixture({
      projectId: '7',
      projectSlug: 'search-service',
      reposCount: 4,
      agent: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
      integrationId: '1002',
      stoppingPoint: 'solution',
    }),
    SeerProjectSettingFixture({
      projectId: '8',
      projectSlug: 'notifications',
      reposCount: 2,
      stoppingPoint: 'root_cause',
      automationTuning: 'low',
    }),
    SeerProjectSettingFixture({
      projectId: '9',
      projectSlug: 'billing-cron',
      reposCount: 1,
      stoppingPoint: 'open_pr',
      automationTuning: 'high',
    }),
  ];
}

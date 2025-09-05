import type {UptimeSummary} from 'sentry/views/alerts/rules/uptime/types';

export function UptimeSummaryFixture(params: Partial<UptimeSummary> = {}): UptimeSummary {
  return {
    downtimeChecks: 5,
    failedChecks: 3,
    missedWindowChecks: 2,
    totalChecks: 100,
    avgDurationUs: 50_000,
    ...params,
  };
}

import {CheckStatus, type UptimeCheck} from 'sentry/views/alerts/rules/uptime/types';


export function UptimeCheckFixture(params: Partial<UptimeCheck> = {}): UptimeCheck {
  return {
    checkStatus: CheckStatus.SUCCESS,
    checkStatusReason: 'success',
    durationMs: 767,
    environment: 'production',
    projectUptimeSubscriptionId: 40123,
    region: 'default',
    regionName: 'Default Region',
    scheduledCheckTime: '2025-01-01T00:00:00Z',
    statusCode: '200',
    timestamp: '2025-01-01T00:00:00Z',
    traceId: '97f0e440317c5bb5b5e0024ca202a61d',
    uptimeCheckId: '97f0e440-317c-5bb5-b5e0-024ca202a61d',
    uptimeSubscriptionId: 40123,
    ...params,
  };
}

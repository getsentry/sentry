import {ActorFixture} from 'sentry-fixture/actor';

import type {UptimeRule} from 'sentry/views/alerts/rules/uptime/types';
import {
  UptimeMonitorMode,
  UptimeMonitorStatus,
} from 'sentry/views/alerts/rules/uptime/types';

export function UptimeRuleFixture(params: Partial<UptimeRule> = {}): UptimeRule {
  return {
    id: '1',
    intervalSeconds: 60,
    mode: UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
    name: 'Uptime Rule',
    owner: ActorFixture(),
    projectSlug: 'project-slug',
    environment: 'prod',
    uptimeStatus: UptimeMonitorStatus.OK,
    status: 'active',
    timeoutMs: 5000,
    url: 'https://sentry.io/',
    headers: [],
    method: 'GET',
    body: null,
    assertion: null,
    traceSampling: false,
    downtimeThreshold: 3,
    recoveryThreshold: 1,
    ...params,
  };
}

import { ActorFixture } from "sentry-fixture/actor";
import { UptimeMonitorMode, UptimeMonitorStatus, UptimeRule } from "sentry/views/alerts/rules/uptime/types";

export function UptimeRuleFixture(params: Partial<UptimeRule> = {}): UptimeRule {
  return {
    id: '1',
    intervalSeconds: 60,
    mode: UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
    name: 'Uptime Rule',
    owner: ActorFixture(),
    projectSlug: 'project-slug',
    environment: 'prod',
    status: UptimeMonitorStatus.OK,
    timeoutMs: 5000,
    url: 'https://sentry.io/',
    headers: [],
    method: 'GET',
    body: null,
    traceSampling: false,
    ...params,
  }
}

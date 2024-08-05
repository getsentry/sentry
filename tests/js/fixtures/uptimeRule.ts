import { ActorFixture } from "sentry-fixture/actor";
import { UptimeMonitorMode, UptimeMonitorStatus, UptimeRule } from "sentry/views/alerts/rules/uptime/types";

export function UptimeRuleFixture(params: Partial<UptimeRule> = {}): UptimeRule {
  return {
    id: '1',
    intervalSeconds: 5,
    mode: UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
    name: 'Uptime Rule',
    owner: ActorFixture(),
    projectSlug: 'project-slug',
    status: UptimeMonitorStatus.OK,
    timeoutMs: 5000,
    url: 'https://sentry.io/',
    ...params,
  }
}

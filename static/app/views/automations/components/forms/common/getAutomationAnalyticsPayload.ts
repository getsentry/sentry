import type {NewAutomation} from 'sentry/types/workflowEngine/automations';

export function getAutomationAnalyticsPayload(automation: NewAutomation): {
  actions_count: number;
  detectors_count: number;
  environment: string | null;
  frequency_minutes: number | null;
  trigger_conditions_count: number;
} {
  const frequency_minutes = automation.config.frequency ?? null;
  const environment = automation.environment;
  const detectors_count = automation.detectorIds.length;
  const trigger_conditions_count = automation.triggers?.conditions?.length ?? 0;
  const actions_count = automation.actionFilters.reduce(
    (total, filter) => total + (filter.actions?.length ?? 0),
    0
  );

  return {
    frequency_minutes,
    environment,
    detectors_count,
    trigger_conditions_count,
    actions_count,
  };
}

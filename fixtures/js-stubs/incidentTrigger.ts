import {AlertRuleTriggerType, SavedTrigger} from 'sentry/views/alerts/rules/metric/types';

export function IncidentTrigger(params: Partial<SavedTrigger> = {}): SavedTrigger {
  return {
    alertRuleId: '4',
    alertThreshold: 70,
    dateCreated: '2019-09-24T18:07:47.714Z',
    id: '1',
    label: AlertRuleTriggerType.CRITICAL,
    actions: [],
    ...params,
  };
}

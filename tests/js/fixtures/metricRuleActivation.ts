import type {AlertRuleActivation} from 'sentry/types/alerts';

export function MetricRuleActivationFixture(
  params: Partial<AlertRuleActivation> = {}
): AlertRuleActivation {
  return {
    activator: '1234',
    alertRuleId: '1234',
    conditionType: '0',
    dateCreated: '2019-07-31T23:02:02.731Z',
    finishedAt: '',
    id: '1',
    isComplete: false,
    querySubscriptionId: '1',
    metricValue: 0,
    ...params,
  };
}

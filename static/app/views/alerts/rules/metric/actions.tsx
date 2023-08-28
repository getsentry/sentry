import {Client} from 'sentry/api';

import {MetricRule, SavedMetricRule} from './types';

function isSavedRule(rule: MetricRule): rule is SavedMetricRule {
  return !!rule.id;
}

/**
 * Add a new rule or update an existing rule
 *
 * @param api API Client
 * @param orgId Organization slug
 * @param rule Saved or Unsaved Metric Rule
 * @param query Query parameters for the request eg - referrer
 */
export function addOrUpdateRule(
  api: Client,
  orgId: string,
  rule: MetricRule,
  query?: object | any
) {
  const isExisting = isSavedRule(rule);
  const endpoint = isExisting
    ? `/organizations/${orgId}/alert-rules/${rule.id}/`
    : `/organizations/${orgId}/alert-rules/`;
  const method = isExisting ? 'PUT' : 'POST';

  return api.requestPromise(endpoint, {
    method,
    data: rule,
    query,
    includeAllArgs: true,
  });
}

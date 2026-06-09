import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {Dataset} from 'sentry/views/alerts/rules/metric/typesBase';

export const ruleNeedsErrorMigration = (rule: MetricRule): boolean => {
  return (
    'dataset' in rule &&
    rule.dataset === Dataset.ERRORS &&
    'query' in rule &&
    !rule.query.includes('is:unresolved')
  );
};

import type {Organization} from 'sentry/types/organization';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

/**
 * Enable ignoring archived issues in metric alerts
 */
export const hasIgnoreArchivedFeatureFlag = (organization: Organization): boolean =>
  organization.features.includes('metric-alert-ignore-archived');

export const ruleNeedsErrorMigration = (rule: MetricRule): boolean => {
  return (
    'dataset' in rule &&
    rule.dataset === Dataset.ERRORS &&
    'query' in rule &&
    !rule.query.includes('is:unresolved')
  );
};

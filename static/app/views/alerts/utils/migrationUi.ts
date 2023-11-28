import {Organization} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {Dataset, MetricRule} from 'sentry/views/alerts/rules/metric/types';
import type {CombinedMetricIssueAlerts} from 'sentry/views/alerts/types';

// TODO(telemetry-experience): remove when the migration is complete
export const hasMigrationFeatureFlag = (organization: Organization): boolean =>
  organization.features.includes('alert-migration-ui');

// TODO(telemetry-experience): remove when the migration is complete
export const ruleNeedsMigration = (
  rule: CombinedMetricIssueAlerts | MetricRule
): boolean => {
  return 'dataset' in rule && rule.dataset === Dataset.TRANSACTIONS;
};
// TODO(telemetry-experience): remove when the migration is complete
export function useOrgNeedsMigration(): boolean {
  const organization = useOrganization();
  const {data = []} = useApiQuery<CombinedMetricIssueAlerts[]>(
    [
      `/organizations/${organization.slug}/combined-rules/`,
      {query: {dataset: Dataset.TRANSACTIONS}},
    ],
    {staleTime: 0}
  );

  const hasTransactionAlerts = data.length > 0;
  const hasFeatureFlag = hasMigrationFeatureFlag(organization);
  return hasTransactionAlerts && hasFeatureFlag;
}

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

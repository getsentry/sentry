import {Organization} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {CombinedMetricIssueAlerts} from 'sentry/views/alerts/types';

export const hasMigrationFeatureFlag = (organization: Organization): boolean =>
  organization.features.includes('alert-migration-ui');

export const ruleNeedsMigration = (rule: CombinedMetricIssueAlerts): boolean => {
  return 'dataset' in rule && rule.dataset === Dataset.TRANSACTIONS;
};

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

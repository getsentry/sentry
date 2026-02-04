import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupList from 'sentry/components/issues/groupList';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';

interface Props {
  project: Project;
  rule: MetricRule;
}

interface AlertRuleDetector {
  alertRuleId: string | null;
  detectorId: string;
  ruleId: string | null;
}

export function MetricAlertOngoingIssues({project, rule}: Props) {
  const organization = useOrganization();
  const ruleId = rule.id;
  const {data: alertRuleDetector, isPending} = useApiQuery<AlertRuleDetector>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/alert-rule-detector/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {alert_rule_id: ruleId}},
    ],
    {
      staleTime: 0,
      enabled: Boolean(ruleId),
      retry: false,
    }
  );

  if (!ruleId) {
    return null;
  }

  const emptyMessage = () => {
    return (
      <Panel>
        <PanelBody>
          <EmptyStateWarning>
            <p>{t('No ongoing issues.')}</p>
          </EmptyStateWarning>
        </PanelBody>
      </Panel>
    );
  };

  if (isPending) {
    return (
      <Panel>
        <PanelBody>
          <Placeholder height="116px" />
        </PanelBody>
      </Panel>
    );
  }

  if (!alertRuleDetector) {
    return emptyMessage();
  }

  return (
    <GroupList
      withChart={false}
      withPagination={false}
      withColumns={['assignee']}
      queryParams={{
        query: `detector:${alertRuleDetector.detectorId}`,
        project: project.id,
      }}
      renderEmptyMessage={emptyMessage}
      numPlaceholderRows={1}
    />
  );
}

import {lazy} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import LazyLoad from 'sentry/components/lazyLoad';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {
  getFilter,
  getPeriodInterval,
} from 'sentry/views/alerts/rules/metric/details/utils';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {extractEventTypeFilterFromRule} from 'sentry/views/alerts/rules/metric/utils/getEventTypeFilter';
import {isCrashFreeAlert} from 'sentry/views/alerts/rules/metric/utils/isCrashFreeAlert';
import {useMetricRule} from 'sentry/views/alerts/rules/metric/utils/useMetricRule';
import {
  useMetricIssueAlertId,
  useMetricTimePeriod,
} from 'sentry/views/issueDetails/metric/utils';

const MetricChart = lazy(
  () => import('sentry/views/alerts/rules/metric/details/metricChart')
);

export function MetricIssueChart({group, project}: {group: Group; project: Project}) {
  const theme = useTheme();
  const api = useApi();
  const organization = useOrganization();

  const ruleId = useMetricIssueAlertId({groupId: group.id});
  const {data: rule} = useMetricRule(
    {
      orgSlug: organization.slug,
      ruleId: ruleId ?? '',
      query: {
        expand: 'latestIncident',
      },
    },
    {
      staleTime: Infinity,
      retry: false,
      enabled: !!ruleId,
    }
  );
  const timePeriod = useMetricTimePeriod({openPeriod: group.openPeriods?.[0]});

  if (!rule || !timePeriod) {
    return null;
  }

  const {dataset, aggregate, query} = rule;
  const formattedAggregate = aggregate;
  const eventType = extractEventTypeFilterFromRule(rule);
  const queryWithTypeFilter =
    dataset === Dataset.EVENTS_ANALYTICS_PLATFORM
      ? query
      : (query ? `(${query}) AND (${eventType})` : eventType).trim();

  return (
    <MetricChartSection>
      <LazyLoad
        theme={theme}
        LazyComponent={MetricChart}
        api={api}
        rule={rule}
        timePeriod={timePeriod}
        organization={organization}
        project={project}
        interval={getPeriodInterval(timePeriod, rule)}
        query={isCrashFreeAlert(dataset) ? query : queryWithTypeFilter}
        filter={getFilter(rule)}
        formattedAggregate={formattedAggregate}
      />
    </MetricChartSection>
  );
}

const MetricChartSection = styled('div')`
  display: block;
  padding-right: ${space(1.5)};
  width: 100%;
`;

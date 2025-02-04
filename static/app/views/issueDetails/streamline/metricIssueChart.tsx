import {Fragment, lazy, useMemo} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {DateTime} from 'sentry/components/dateTime';
import LazyLoad from 'sentry/components/lazyLoad';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {formatMRIField} from 'sentry/utils/metrics/mri';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {
  getFilter,
  getPeriodInterval,
} from 'sentry/views/alerts/rules/metric/details/utils';
import {
  Dataset,
  type MetricRule,
  TimePeriod,
} from 'sentry/views/alerts/rules/metric/types';
import {extractEventTypeFilterFromRule} from 'sentry/views/alerts/rules/metric/utils/getEventTypeFilter';
import {isCrashFreeAlert} from 'sentry/views/alerts/rules/metric/utils/isCrashFreeAlert';
import {isCustomMetricAlert} from 'sentry/views/alerts/rules/metric/utils/isCustomMetricAlert';

const MetricChart = lazy(
  () => import('sentry/views/alerts/rules/metric/details/metricChart')
);

export function MetricIssueChart({
  event,
  group,
  project,
}: {
  event: Event | undefined;
  group: Group;
  project: Project;
}) {
  const api = useApi();
  const organization = useOrganization();

  const ruleId = event?.contexts?.metric_alert?.alert_rule_id;
  const {data: rule} = useApiQuery<MetricRule>(
    [
      `/organizations/${organization.slug}/alert-rules/${ruleId}/`,
      {
        query: {
          expand: 'latestIncident',
        },
      },
    ],
    {
      staleTime: Infinity,
      retry: false,
    }
  );

  const openPeriod = group.openPeriods?.[0];
  const timePeriod = useMemo((): TimePeriodType | null => {
    if (!openPeriod) {
      return null;
    }
    const start = openPeriod.start;
    let end = openPeriod.end;
    if (!end) {
      end = new Date().toISOString();
    }
    return {
      start,
      end,
      period: TimePeriod.SEVEN_DAYS,
      usingPeriod: false,
      label: t('Custom time'),
      display: (
        <Fragment>
          <DateTime date={moment.utc(start)} />
          {' — '}
          <DateTime date={moment.utc(end)} />
        </Fragment>
      ),
      custom: true,
    };
  }, [openPeriod]);

  if (!rule || !timePeriod) {
    return null;
  }

  const {dataset, aggregate, query} = rule;
  let formattedAggregate = aggregate;
  if (isCustomMetricAlert(aggregate)) {
    formattedAggregate = formatMRIField(aggregate);
  }
  const eventType = extractEventTypeFilterFromRule(rule);
  const queryWithTypeFilter =
    dataset === Dataset.EVENTS_ANALYTICS_PLATFORM
      ? query
      : (query ? `(${query}) AND (${eventType})` : eventType).trim();

  return (
    <MetricChartSection>
      <LazyLoad
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

import {Fragment, lazy, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {DateTime} from 'sentry/components/dateTime';
import LazyLoad from 'sentry/components/lazyLoad';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {
  getFilter,
  getPeriodInterval,
} from 'sentry/views/alerts/rules/metric/details/utils';
import {Dataset, TimePeriod} from 'sentry/views/alerts/rules/metric/types';
import {extractEventTypeFilterFromRule} from 'sentry/views/alerts/rules/metric/utils/getEventTypeFilter';
import {isCrashFreeAlert} from 'sentry/views/alerts/rules/metric/utils/isCrashFreeAlert';
import {useMetricRule} from 'sentry/views/alerts/rules/metric/utils/useMetricRule';

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
  const theme = useTheme();
  const api = useApi();
  const organization = useOrganization();

  const ruleId = event?.contexts?.metric_alert?.alert_rule_id;

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

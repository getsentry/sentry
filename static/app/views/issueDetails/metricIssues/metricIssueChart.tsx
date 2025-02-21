import styled from '@emotion/styled';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
import {Alert} from 'sentry/components/core/alert';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {useMetricRule} from 'sentry/views/alerts/rules/metric/utils/useMetricRule';
import type {Anomaly, Incident} from 'sentry/views/alerts/types';
import {useMetricAnomalies} from 'sentry/views/issueDetails/metricIssues/useMetricAnomalies';
import {useMetricIncidents} from 'sentry/views/issueDetails/metricIssues/useMetricIncidents';
import {useMetricStatsChart} from 'sentry/views/issueDetails/metricIssues/useMetricStatsChart';
import {
  useMetricIssueAlertId,
  useMetricIssueLegend,
  useMetricTimePeriod,
} from 'sentry/views/issueDetails/metricIssues/utils';

interface MetricIssueChartProps {
  group: Group;
  project: Project;
}

export function MetricIssueChart({group, project}: MetricIssueChartProps) {
  const organization = useOrganization();
  const ruleId = useMetricIssueAlertId({groupId: group.id});
  const timePeriod = useMetricTimePeriod();
  const {
    data: rule,
    isLoading: isRuleLoading,
    isError: isRuleError,
  } = useMetricRule(
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
  const {data: anomalies = [], isLoading: isAnomaliesLoading} = useMetricAnomalies(
    {
      orgSlug: organization.slug,
      ruleId: ruleId ?? '',
      query: {
        start: timePeriod.start,
        end: timePeriod.end,
      },
    },
    {
      enabled:
        !!ruleId && organization.features.includes('anomaly-detection-alerts-charts'),
    }
  );
  const {data: incidents = [], isLoading: isIncidentsLoading} = useMetricIncidents(
    {
      orgSlug: organization.slug,
      query: {
        alertRule: ruleId ?? '',
        start: timePeriod.start,
        end: timePeriod.end,
      },
    },
    {
      enabled: !!ruleId,
    }
  );

  if (isRuleLoading || isAnomaliesLoading || isIncidentsLoading || !rule) {
    return (
      <MetricChartSection>
        <MetricIssuePlaceholder type="loading" />
      </MetricChartSection>
    );
  }

  if (!rule || isRuleError) {
    return <MetricIssuePlaceholder type="error" />;
  }

  return (
    <MetricChartSection>
      <MetricIssueChartContent
        rule={rule}
        timePeriod={timePeriod}
        project={project}
        anomalies={anomalies}
        incidents={incidents}
      />
    </MetricChartSection>
  );
}

/**
 * This component is nested to avoid trying to fetch data without a rule or time period.
 */
function MetricIssueChartContent({
  rule,
  timePeriod,
  project,
  anomalies,
  incidents,
}: {
  project: Project;
  rule: MetricRule;
  timePeriod: TimePeriodType;
  anomalies?: Anomaly[];
  incidents?: Incident[];
}) {
  const chartZoomProps = useChartZoom({saveOnZoom: true});
  const {chartProps, queryResult} = useMetricStatsChart({
    project,
    rule,
    timePeriod,
    anomalies,
    incidents,
    referrer: 'metric-issue-chart',
  });
  const {series = [], yAxis, ...otherChartProps} = chartProps;
  const legend = useMetricIssueLegend({rule, series});

  if (queryResult?.isLoading) {
    return <MetricIssuePlaceholder type="loading" />;
  }

  if (queryResult?.isError) {
    return <MetricIssuePlaceholder type="error" />;
  }

  return (
    <ChartContainer role="figure">
      <AreaChart
        {...otherChartProps}
        series={series}
        legend={{...legend, top: 4, right: 4}}
        height={100}
        grid={{
          top: 20,
          right: 0,
          left: 0,
          bottom: 0,
        }}
        yAxis={{
          ...yAxis,
          splitNumber: 2,
        }}
        {...chartZoomProps}
      />
    </ChartContainer>
  );
}

function MetricIssuePlaceholder({type}: {type: 'loading' | 'error'}) {
  return type === 'loading' ? (
    <PlaceholderContainer>
      <Placeholder height="96px" testId="metric-issue-chart-loading" />
    </PlaceholderContainer>
  ) : (
    <MetricChartAlert type="error" showIcon>
      {t('Unable to load the metric history')}
    </MetricChartAlert>
  );
}

const MetricChartSection = styled('div')`
  display: block;
  padding-right: ${space(1.5)};
  width: 100%;
`;

const PlaceholderContainer = styled('div')`
  padding: ${space(1)} 0;
`;

const ChartContainer = styled('div')`
  position: relative;
  padding: ${space(0.75)} 0;
`;

const MetricChartAlert = styled(Alert)`
  width: 100%;
  border: 0;
  border-radius: 0;
`;

import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {AreaChart} from 'sentry/components/charts/areaChart';
import Legend from 'sentry/components/charts/components/legend';
import {defaultFormatAxisLabel} from 'sentry/components/charts/components/tooltip';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
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
  const {data: rule, isLoading: isRuleLoading} = useMetricRule(
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
  const {data: rawIncidents = [], isLoading: isIncidentsLoading} = useMetricIncidents(
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
  const incidents = useMemo(() => {
    return rawIncidents.map(incident => ({
      ...incident,
      // We do this to omit the label from the graph
      identifier: '',
    }));
  }, [rawIncidents]);

  if (isRuleLoading || isAnomaliesLoading || isIncidentsLoading) {
    return (
      <MetricChartSection>
        <MetricIssuePlaceholder type="loading" />
      </MetricChartSection>
    );
  }

  if (!rule) {
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
  const theme = useTheme();
  const chartZoomProps = useChartZoom({saveOnZoom: true});
  const {chartProps, queryResult} = useMetricStatsChart({
    project,
    rule,
    timePeriod,
    anomalies,
    incidents,
    referrer: 'metric-issue-chart',
  });
  const {series = [], ...otherChartProps} = chartProps;

  // We don't want to show the aggregate in the legend, since it can't be toggled off.
  const legendItems = useMemo(() => {
    const legendSet = new Set(series.map(s => s.seriesName));
    if (legendSet.has(rule.aggregate)) {
      legendSet.delete(rule.aggregate);
    }
    return Array.from(legendSet);
  }, [series, rule.aggregate]);

  if (queryResult?.isLoading) {
    return <MetricIssuePlaceholder type="loading" />;
  }

  if (queryResult?.isError) {
    return <MetricIssuePlaceholder type="error" />;
  }

  const legend = Legend({
    theme,
    orient: 'horizontal',
    align: 'left',
    show: true,
    top: 4,
    right: 8,
    data: legendItems,
    inactiveColor: theme.gray200,
  });

  return (
    <ChartContainer role="figure">
      <AreaChart
        {...otherChartProps}
        series={series}
        legend={legend}
        height={100}
        grid={{
          top: 20,
          right: 0,
          left: 0,
          bottom: 0,
        }}
        tooltip={{
          formatAxisLabel: (
            value,
            isTimestamp,
            utc,
            showTimeInTooltip,
            addSecondsToTimeFormat,
            bucketSize,
            _seriesParamsOrParam
          ) =>
            String(
              defaultFormatAxisLabel(
                value,
                isTimestamp,
                utc,
                showTimeInTooltip,
                addSecondsToTimeFormat,
                bucketSize
              )
            ),
        }}
        yAxis={{
          splitNumber: 2,
          minInterval: 1,
          axisLabel: {
            formatter: (value: number) => {
              return formatAbbreviatedNumber(value);
            },
          },
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

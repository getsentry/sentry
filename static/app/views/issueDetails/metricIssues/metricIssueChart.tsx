import {useMemo} from 'react';
import styled from '@emotion/styled';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {defaultFormatAxisLabel} from 'sentry/components/charts/components/tooltip';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
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
  const {data: anomalies = []} = useMetricAnomalies(
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
  const {data: rawIncidents = []} = useMetricIncidents(
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

  if (!rule) {
    return null;
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
  const {chartProps} = useMetricStatsChart({
    project,
    rule,
    timePeriod,
    anomalies,
    incidents,
    referrer: 'metric-issue-chart',
  });

  return (
    <ChartContainer role="figure">
      <AreaChart
        series={[]}
        {...chartProps}
        height={100}
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

const MetricChartSection = styled('div')`
  display: block;
  padding-right: ${space(1.5)};
  width: 100%;
`;

const ChartContainer = styled('div')`
  position: relative;
  padding: ${space(0.75)} ${space(1)} ${space(0.75)} 0;
`;

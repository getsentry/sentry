import {Fragment, memo, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';
import moment from 'moment-timezone';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {BarChart} from 'sentry/components/charts/barChart';
import Legend from 'sentry/components/charts/components/legend';
import type {TooltipSubLabel} from 'sentry/components/charts/components/tooltip';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
import {getInterval, type DateTimeObject} from 'sentry/components/charts/utils';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {DataCategoryExact} from 'sentry/types/core';
import type {DataPoint} from 'sentry/types/echarts';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import getDynamicText from 'sentry/utils/getDynamicText';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';

import type {StatsGroup} from './customerStats';

interface Stats {
  groups: StatsGroup[];
  intervals: Array<string | number>;
}

interface SeriesItem {
  data: DataPoint[];
  seriesName: string;
  color?: string;
  subSeries?: Array<{data: DataPoint[]; seriesName: string}>;
}

const ABUSE_REASON_CODES = new Set(['project_abuse_limit', 'org_abuse_limit']);

function isAbuseGroup(group: StatsGroup): boolean {
  return (
    group.by.outcome === 'abuse' ||
    (group.by.outcome === 'rate_limited' && ABUSE_REASON_CODES.has(group.by.reason))
  );
}

function populateAbuseChartData(
  intervals: Array<string | number>,
  groups: StatsGroup[],
  theme: ReturnType<typeof useTheme>
): {legend: string[]; series: SeriesItem[]; subLabels: TooltipSubLabel[]} {
  const abuseSeries: SeriesItem = {
    seriesName: 'Abuse',
    data: [],
    color: theme.tokens.graphics.danger.vibrant,
  };

  const reasonsMap: Record<string, {data: DataPoint[]; seriesName: string}> = {};

  const abuseGroups = groups.filter(isAbuseGroup);

  intervals.forEach((timestamp, dateIndex) => {
    abuseGroups.forEach(point => {
      const reason = point.by.reason || 'none';
      const dataObject = {
        name: timestamp.toString(),
        value: point.series['sum(quantity)']![dateIndex]!,
      };

      if (dateIndex >= abuseSeries.data.length) {
        abuseSeries.data.push({...dataObject});
      } else {
        abuseSeries.data[dateIndex]!.value += dataObject.value;
      }

      if (reason !== 'none') {
        if (!reasonsMap[reason]) {
          reasonsMap[reason] = {
            seriesName: startCase(reason.replace(/-|_/g, ' ')),
            data: [],
          };
        }
        reasonsMap[reason].data.push(dataObject);
      }
    });
  });

  const subLabels: TooltipSubLabel[] = [];
  for (const sub of Object.values(reasonsMap)) {
    abuseSeries.subSeries = abuseSeries.subSeries ?? [];
    abuseSeries.subSeries.push(sub);
    subLabels.push({
      parentLabel: 'Abuse',
      label: sub.seriesName,
      data: sub.data,
    });
  }

  const legend = abuseSeries.data.length > 0 ? ['Abuse'] : [];

  return {series: [abuseSeries], legend, subLabels};
}

function FooterLegend({groups}: {groups: StatsGroup[]}) {
  let total = 0;

  groups.filter(isAbuseGroup).forEach(point => {
    total += point.totals['sum(quantity)'] ?? 0;
  });

  return (
    <Flex align="center" gap="xs">
      <strong>Total Abuse</strong>
      {total.toLocaleString()}
    </Flex>
  );
}

interface Props {
  dataType: DataCategoryExact;
  orgSlug: Organization['slug'];
  onDemandPeriodEnd?: string;
  onDemandPeriodStart?: string;
  projectId?: Project['id'];
}

export const CustomerAbuseStats = memo(
  ({orgSlug, projectId, dataType, onDemandPeriodStart, onDemandPeriodEnd}: Props) => {
    const location = useLocation();
    const theme = useTheme();
    const chartZoomProps = useChartZoom({usePageDate: true});

    const dataDatetime = useMemo((): DateTimeObject => {
      const {
        start,
        end,
        utc: utcString,
        statsPeriod,
      } = normalizeDateTimeParams(location.query, {
        allowEmptyPeriod: true,
        allowAbsoluteDatetime: true,
        allowAbsolutePageDatetime: true,
      });

      const utc = utcString === 'true';

      if (!start && !end && !statsPeriod && onDemandPeriodStart && onDemandPeriodEnd) {
        return {
          start: onDemandPeriodStart,
          end: onDemandPeriodEnd,
        };
      }

      if (start && end) {
        return utc
          ? {
              start: moment.utc(start).format(),
              end: moment.utc(end).format(),
              utc,
            }
          : {
              start: moment(start).utc().format(),
              end: moment(end).utc().format(),
              utc,
            };
      }

      return {
        period: statsPeriod ?? '90d',
      };
    }, [location.query, onDemandPeriodStart, onDemandPeriodEnd]);

    const {
      isPending: loading,
      error,
      data: stats,
      refetch,
    } = useApiQuery<Stats>(
      [
        getApiUrl(`/organizations/$organizationIdOrSlug/stats_v2/`, {
          path: {organizationIdOrSlug: orgSlug},
        }),
        {
          query: {
            start: dataDatetime.start,
            end: dataDatetime.end,
            utc: dataDatetime.utc,
            statsPeriod: dataDatetime.period,
            interval: getInterval(dataDatetime),
            groupBy: ['outcome', 'reason'],
            field: 'sum(quantity)',
            category: dataType,
            outcome: ['abuse', 'rate_limited'],
            ...(projectId ? {project: projectId} : {}),
          },
        },
      ],
      {
        staleTime: Infinity,
        retry: false,
      }
    );

    if (loading) {
      return <LoadingIndicator />;
    }

    if (error) {
      return <LoadingError onRetry={refetch} />;
    }

    const {intervals, groups} = stats;
    const hasData = groups
      .filter(isAbuseGroup)
      .some(g => (g.totals['sum(quantity)'] ?? 0) > 0);

    if (!hasData) {
      return (
        <Flex justify="center" padding="2xl">
          <Text variant="muted">No abuse data for this period.</Text>
        </Flex>
      );
    }

    const {series, legend, subLabels} = populateAbuseChartData(intervals, groups, theme);

    return (
      <Fragment>
        {getDynamicText({
          value: (
            <Fragment>
              <BarChart
                stacked
                animation={false}
                series={series}
                colors={series.map(s => s.color).filter(defined)}
                tooltip={{subLabels}}
                legend={Legend({
                  right: 10,
                  top: 0,
                  data: legend,
                  theme,
                })}
                grid={{top: 30, bottom: 0, left: 0, right: 0}}
                {...chartZoomProps}
              />
              <Footer borderTop="primary" padding="xl">
                <FooterLegend groups={groups} />
              </Footer>
            </Fragment>
          ),
          fixed: 'Customer Abuse Stats Chart',
        })}
      </Fragment>
    );
  }
);

const Footer = styled(Flex)`
  margin: ${p => p.theme.space['2xl']} -${p => p.theme.space.xl} -${p =>
      p.theme.space.xl} -${p => p.theme.space.xl};
  color: ${p => p.theme.tokens.content.secondary};
`;

import {Fragment, memo, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import startCase from 'lodash/startCase';
import moment from 'moment-timezone';

import {BarChart} from 'sentry/components/charts/barChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import Legend from 'sentry/components/charts/components/legend';
import type {TooltipSubLabel} from 'sentry/components/charts/components/tooltip';
import {getInterval, type DateTimeObject} from 'sentry/components/charts/utils';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {space} from 'sentry/styles/space';
import type {DataCategoryExact} from 'sentry/types/core';
import type {DataPoint} from 'sentry/types/echarts';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import getDynamicText from 'sentry/utils/getDynamicText';
import {useApiQuery} from 'sentry/utils/queryClient';
import useRouter from 'sentry/utils/useRouter';

enum SeriesName {
  ACCEPTED = 'Accepted',
  FILTERED = 'Filtered (Server)',
  OVER_QUOTA = 'Over Quota',
  DISCARDED = 'Discarded (Client)',
  DROPPED = 'Dropped (Server)',
}

type SubSeries = {
  data: DataPoint[];
  seriesName: string;
};

type SeriesItem = {
  data: DataPoint[];
  seriesName: string;
  color?: string;
  subSeries?: SubSeries[];
};

export type StatsGroup = {
  by: {
    outcome: string;
    reason: string;
  };
  series: Record<string, number[]>;
  totals: Record<string, number>;
};

type Stats = {
  groups: StatsGroup[];
  intervals: Array<string | number>;
};

type LegendProps = {
  points: Stats;
};

export const useSeries = (): Record<string, SeriesItem> => {
  const theme = useTheme();
  return {
    accepted: {
      seriesName: SeriesName.ACCEPTED,
      data: [],
      color: theme.purple300,
    },
    overQuota: {
      seriesName: SeriesName.OVER_QUOTA,
      data: [],
      color: theme.pink200,
    },
    totalFiltered: {
      seriesName: SeriesName.FILTERED,
      data: [],
      color: theme.purple200,
    },
    totalDiscarded: {
      seriesName: SeriesName.DISCARDED,
      data: [],
      color: theme.yellow300,
    },
    totalDropped: {
      seriesName: SeriesName.DROPPED,
      data: [],
      color: theme.red300,
    },
  };
};

function zeroFillDates(start: number, end: number, {color}: {color: string}) {
  const zero: SeriesItem = {
    seriesName: SeriesName.ACCEPTED,
    data: [],
    color,
  };

  const numberOfIntervals = Math.ceil((end - start) / 86400);

  if (numberOfIntervals >= 0) {
    zero.data = [...new Array(numberOfIntervals).keys()].map(i => ({
      name: new Date((start + (i + 1) * 86400) * 1000).toString(),
      value: 0,
    }));
  }

  return zero;
}

export function populateChartData(
  intervals: Array<string | number>,
  groups: StatsGroup[],
  series: Record<string, SeriesItem>
): SeriesItem[] {
  const {accepted, totalFiltered, totalDiscarded, totalDropped, overQuota} =
    cloneDeep(series);

  const outcomeMapping = {accepted, totalDiscarded};

  const filteredData: Record<string, SeriesItem> = {};
  const discardedData: Record<string, SeriesItem> = {};
  const droppedData: Record<string, SeriesItem> = {};

  intervals.forEach((timestamp, dateIndex) => {
    groups.forEach(point => {
      const dataObject = {
        name: timestamp.toString(),
        value: point.series['sum(quantity)']![dateIndex]!,
      };

      if (point.by.outcome === 'filtered') {
        if (point.by.reason?.startsWith('Sampled:')) {
          if (filteredData['dynamic-sampling'] === undefined) {
            filteredData['dynamic-sampling'] = {
              seriesName: 'Dynamic Sampling',
              data: [],
            };
          }

          if (dateIndex >= filteredData['dynamic-sampling'].data.length) {
            filteredData['dynamic-sampling'].data.push(dataObject);
          } else {
            filteredData['dynamic-sampling'].data[dateIndex]!.value += dataObject.value;
          }
        } else {
          // dynamically adding filtered reasons into graph
          if (filteredData[point.by.reason] === undefined) {
            filteredData[point.by.reason] = {
              seriesName: startCase(point.by.reason?.replace(/-|_/g, ' ')),
              data: [],
            };
          }

          filteredData[point.by.reason]!.data.push(dataObject);
        }

        if (dateIndex >= totalFiltered!.data.length) {
          totalFiltered!.data.push({...dataObject, value: 0});
        }

        return;
      }

      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      if (outcomeMapping[point.by.outcome]) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        if (dateIndex >= outcomeMapping[point.by.outcome].data.length) {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          outcomeMapping[point.by.outcome].data.push(dataObject);
          return;
        }
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        outcomeMapping[point.by.outcome].data[dateIndex].value += dataObject.value;
        return;
      }

      // below are the dropped outcome cases
      if (['usage_exceeded', 'grace_period'].includes(point.by.reason)) {
        // combined usage_exceeded and grace_period into over quota (grace_period kept for historical data)
        if (dateIndex >= overQuota!.data.length) {
          overQuota!.data.push(dataObject);
          return;
        }
        overQuota!.data[dateIndex]!.value += dataObject.value;
        return;
      }

      if (point.by.outcome === 'client_discard') {
        // dynamically adding discarded reasons into graph
        if (discardedData[point.by.reason] === undefined) {
          discardedData[point.by.reason] = {
            seriesName: startCase(point.by.reason?.replace(/-|_/g, ' ')),
            data: [],
          };
        }

        discardedData[point.by.reason]!.data.push(dataObject);

        if (dateIndex >= totalDiscarded!.data.length) {
          totalDiscarded!.data.push({...dataObject, value: 0});
        }

        return;
      }

      if (point.by.outcome === 'abuse' && point.by.reason === 'none') {
        if (droppedData.abuse === undefined) {
          droppedData.abuse = {
            seriesName: 'Abuse',
            data: [],
          };
        }

        droppedData.abuse.data.push(dataObject);

        if (dateIndex >= totalDropped!.data.length) {
          totalDropped!.data.push({...dataObject, value: 0});
        }

        return;
      }

      // dynamically adding dropped reasons into graph
      if (droppedData[point.by.reason] === undefined) {
        droppedData[point.by.reason] = {
          seriesName: startCase(point.by.reason?.replace(/-|_/g, ' ')),
          data: [],
        };
      }

      droppedData[point.by.reason]!.data.push(dataObject);

      if (dateIndex >= totalDropped!.data.length) {
        totalDropped!.data.push({...dataObject, value: 0});
      }
    });
  });

  for (const data of Object.values(filteredData)) {
    totalFiltered!.subSeries = totalFiltered!.subSeries ?? [];
    totalFiltered!.subSeries.push({seriesName: data.seriesName, data: data.data});

    for (const [dataIndex, dataPoint] of data.data.entries()) {
      totalFiltered!.data[dataIndex]!.value += dataPoint.value;
    }
  }

  for (const data of Object.values(discardedData)) {
    totalDiscarded!.subSeries = totalDiscarded!.subSeries ?? [];
    totalDiscarded!.subSeries.push({seriesName: data.seriesName, data: data.data});

    for (const [dataIndex, dataPoint] of data.data.entries()) {
      totalDiscarded!.data[dataIndex]!.value += dataPoint.value;
    }
  }

  for (const data of Object.values(droppedData)) {
    totalDropped!.subSeries = totalDropped!.subSeries ?? [];
    totalDropped!.subSeries.push({seriesName: data.seriesName, data: data.data});

    for (const [dataIndex, dataPoint] of data.data.entries()) {
      if (totalDropped?.data[dataIndex]) {
        totalDropped.data[dataIndex].value += dataPoint.value;
      }
    }
  }

  return [accepted!, totalFiltered!, overQuota!, totalDiscarded!, totalDropped!];
}

function FooterLegend({points}: LegendProps) {
  let accepted = 0;
  let filtered = 0;
  let total = 0;
  let discarded = 0;
  let dropped = 0;

  points.groups.forEach(point => {
    switch (point.by.outcome) {
      case 'filtered':
        filtered += point.totals['sum(quantity)']!;
        break;
      case 'accepted':
        accepted += point.totals['sum(quantity)']!;
        break;
      case 'client_discard':
        discarded += point.totals['sum(quantity)']!;
        break;
      default:
        dropped += point.totals['sum(quantity)']!;
        break;
    }
    total += point.totals['sum(quantity)']!;
  });

  return (
    <LegendContainer>
      <div>
        <strong>Total</strong>
        {total.toLocaleString()}
      </div>
      <div>
        <strong>{SeriesName.ACCEPTED}</strong>
        {accepted.toLocaleString()}
      </div>
      <div>
        <strong>{SeriesName.FILTERED}</strong>
        {filtered.toLocaleString()}
      </div>
      <div>
        <strong>{SeriesName.DISCARDED}</strong>
        {discarded.toLocaleString()}
      </div>
      <div>
        <strong>{SeriesName.DROPPED}</strong>
        {dropped.toLocaleString()}
      </div>
    </LegendContainer>
  );
}

type Props = {
  dataType: DataCategoryExact;
  orgSlug: Organization['slug'];
  onDemandPeriodEnd?: string;
  onDemandPeriodStart?: string;
  projectId?: Project['id'];
};

export const CustomerStats = memo(
  ({orgSlug, projectId, dataType, onDemandPeriodStart, onDemandPeriodEnd}: Props) => {
    const router = useRouter();

    const dataDatetime = useMemo((): DateTimeObject => {
      const {
        start,
        end,
        utc: utcString,
        statsPeriod,
      } = normalizeDateTimeParams(router.location.query, {
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
    }, [router.location.query, onDemandPeriodStart, onDemandPeriodEnd]);

    const {
      isPending: loading,
      error,
      data: stats,
      refetch,
    } = useApiQuery<Stats>(
      [
        `/organizations/${orgSlug}/stats_v2/`,
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
            ...(projectId ? {project: projectId} : {}),
          },
        },
      ],
      {
        staleTime: Infinity,
        retry: false,
      }
    );

    const theme = useTheme();
    const series = useSeries();

    if (loading) {
      return <LoadingIndicator />;
    }

    if (error) {
      return <LoadingError onRetry={refetch} />;
    }

    if (!stats) {
      return null;
    }

    const {intervals, groups} = stats;

    const zeroFillStart =
      Number(new Date(intervals[intervals.length - 1]!)) / 1000 + 86400;

    const chartSeries = [
      ...populateChartData(intervals, groups, series),
      zeroFillDates(
        zeroFillStart,
        new Date(dataDatetime.end ?? moment().format()).valueOf() / 1000,
        {color: theme.purple200}
      ),
    ];

    const {legend, subLabels} = chartSeries.reduce(
      (acc, serie) => {
        if (!acc.legend.includes(serie.seriesName) && serie.data.length > 0) {
          acc.legend.push(serie.seriesName);
        }

        if (!serie.subSeries) {
          return acc;
        }

        for (const subSerie of serie.subSeries) {
          acc.subLabels.push({
            parentLabel: serie.seriesName,
            label: subSerie.seriesName,
            data: subSerie.data,
          });
        }

        return acc;
      },
      {
        legend: [] as string[],
        subLabels: [] as TooltipSubLabel[],
      }
    );

    return (
      <Fragment>
        {getDynamicText({
          value: (
            <ChartZoom
              period={dataDatetime.period}
              start={dataDatetime.start}
              end={dataDatetime.end}
              utc={dataDatetime.utc}
            >
              {zoomRenderProps => (
                <Fragment>
                  <BarChart
                    isGroupedByDate
                    stacked
                    animation={false}
                    series={chartSeries}
                    colors={Object.values(series)
                      .map(serie => serie.color)
                      .filter(defined)}
                    tooltip={{subLabels}}
                    legend={Legend({
                      right: 10,
                      top: 0,
                      data: legend,
                      theme,
                    })}
                    grid={{top: 30, bottom: 0, left: 0, right: 0}}
                    {...zoomRenderProps}
                  />
                  <Footer>
                    <FooterLegend points={stats} />
                  </Footer>
                </Fragment>
              )}
            </ChartZoom>
          ),
          fixed: 'Customer Stats Chart',
        })}
      </Fragment>
    );
  }
);

const Footer = styled('div')`
  display: flex;
  justify-content: space-between;
  border-top: 1px solid ${p => p.theme.border};
  margin: ${space(3)} -${space(2)} -${space(2)} -${space(2)};
  padding: ${space(2)};
  color: ${p => p.theme.subText};
`;

const LegendContainer = styled('div')`
  &,
  > div {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: ${space(4)};
  }

  > div {
    gap: ${space(0.5)};
  }
`;

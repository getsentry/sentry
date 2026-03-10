import {Fragment, memo, useCallback, useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import startCase from 'lodash/startCase';
import moment from 'moment-timezone';

import {BarChart} from 'sentry/components/charts/barChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import Legend from 'sentry/components/charts/components/legend';
import MarkArea from 'sentry/components/charts/components/markArea';
import type {TooltipSubLabel} from 'sentry/components/charts/components/tooltip';
import {getInterval, type DateTimeObject} from 'sentry/components/charts/utils';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {DataCategoryExact} from 'sentry/types/core';
import type {DataPoint, ReactEchartsRef} from 'sentry/types/echarts';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import getApiUrl from 'sentry/utils/api/getApiUrl';
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
      color: theme.tokens.graphics.accent.vibrant,
    },
    overQuota: {
      seriesName: SeriesName.OVER_QUOTA,
      data: [],
      color: theme.tokens.graphics.promotion.moderate,
    },
    totalFiltered: {
      seriesName: SeriesName.FILTERED,
      data: [],
      color: theme.tokens.graphics.accent.moderate,
    },
    totalDiscarded: {
      seriesName: SeriesName.DISCARDED,
      data: [],
      color: theme.tokens.graphics.warning.vibrant,
    },
    totalDropped: {
      seriesName: SeriesName.DROPPED,
      data: [],
      color: theme.tokens.graphics.danger.vibrant,
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

      if (
        point.by.outcome === 'abuse' &&
        (!point.by.reason || point.by.reason === 'none')
      ) {
        if (droppedData.abuse === undefined) {
          droppedData.abuse = {
            seriesName: 'Abuse',
            data: [],
          };
        }

        if (dateIndex >= droppedData.abuse.data.length) {
          droppedData.abuse.data.push(dataObject);
        } else {
          droppedData.abuse.data[dateIndex]!.value += dataObject.value;
        }

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

type AbuseRegion = {
  end: number;
  start: number;
};

type AbuseData = {
  regions: AbuseRegion[];
  valueByTimestamp: Map<number, number>;
};

function getAbuseData(
  intervals: Array<string | number>,
  groups: StatsGroup[]
): AbuseData {
  // Sum abuse quantities per interval
  const abuseByInterval = new Array(intervals.length).fill(0) as number[];
  for (const group of groups) {
    if (group.by.outcome === 'abuse') {
      group.series['sum(quantity)']?.forEach((val, i) => {
        abuseByInterval[i]! += val;
      });
    }
  }

  // Build a map of timestamp → abuse value and contiguous regions where abuse > 0
  const valueByTimestamp = new Map<number, number>();
  const regions: AbuseRegion[] = [];
  let regionStart: number | null = null;
  let regionEnd: number | null = null;

  for (let i = 0; i < intervals.length; i++) {
    const ts = new Date(intervals[i]!).getTime();

    if (abuseByInterval[i]! > 0) {
      valueByTimestamp.set(ts, abuseByInterval[i]!);
      if (regionStart === null) {
        regionStart = ts;
      }
      regionEnd = ts;
    } else if (regionStart !== null && regionEnd !== null) {
      regions.push({start: regionStart, end: regionEnd});
      regionStart = null;
      regionEnd = null;
    }
  }

  if (regionStart !== null && regionEnd !== null) {
    regions.push({start: regionStart, end: regionEnd});
  }

  return {regions, valueByTimestamp};
}

function buildAbuseMarkAreaSeries(
  regions: AbuseRegion[],
  theme: ReturnType<typeof useTheme>,
  intervalMs: number
) {
  if (regions.length === 0) {
    return [];
  }

  // Extend regions by half an interval on each side so the mark area
  // covers the full width of the edge bars
  const halfInterval = intervalMs / 2;
  const markAreaData = regions.map(
    r =>
      [
        {xAxis: new Date(r.start - halfInterval).toISOString()},
        {xAxis: new Date(r.end + halfInterval).toISOString()},
      ] as [{xAxis: string}, {xAxis: string}]
  );

  return [
    {
      seriesName: '',
      data: [] as DataPoint[],
      markArea: MarkArea({
        silent: true,
        itemStyle: {
          color: theme.tokens.graphics.danger.muted,
          opacity: 0.25,
        },
        label: {
          show: false,
        },
        data: markAreaData,
      }),
    } as SeriesItem,
  ];
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

    const statsEndpointUrl = getApiUrl(`/organizations/$organizationIdOrSlug/stats_v2/`, {
      path: {organizationIdOrSlug: orgSlug},
    });

    const {
      isPending: loading,
      error,
      data: stats,
      refetch,
    } = useApiQuery<Stats>(
      [
        statsEndpointUrl,
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

    // Abuse outcomes only exist under the 'error' category, so we fetch them
    // separately to show abuse limit periods regardless of the selected category.
    const {data: abuseStats} = useApiQuery<Stats>(
      [
        statsEndpointUrl,
        {
          query: {
            start: dataDatetime.start,
            end: dataDatetime.end,
            utc: dataDatetime.utc,
            statsPeriod: dataDatetime.period,
            interval: getInterval(dataDatetime),
            groupBy: ['outcome', 'category'],
            field: 'sum(quantity)',
            outcome: ['abuse'],
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
    const chartRef = useRef<ReactEchartsRef>(null);
    const abuseTooltipRef = useRef<HTMLDivElement>(null);

    const abuseData = useMemo(
      () =>
        abuseStats
          ? getAbuseData(abuseStats.intervals, abuseStats.groups)
          : {regions: [], valueByTimestamp: new Map<number, number>()},
      [abuseStats]
    );

    const abuseDataRef = useRef(abuseData);
    abuseDataRef.current = abuseData;

    const cleanupRef = useRef<(() => void) | null>(null);
    const chartContainerRef = useCallback((node: HTMLDivElement | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;

      if (!node) {
        return;
      }

      const showTooltip = (x: number, value: number) => {
        const el = abuseTooltipRef.current;
        if (!el) {
          return;
        }
        el.style.left = `${x}px`;
        el.textContent = `Abuse: ${value.toLocaleString()}`;
        el.style.display = 'flex';
      };

      const hideTooltip = () => {
        const el = abuseTooltipRef.current;
        if (el) {
          el.style.display = 'none';
        }
      };

      const handleMouseMove = (e: MouseEvent) => {
        const instance = chartRef.current?.getEchartsInstance();
        const {regions, valueByTimestamp} = abuseDataRef.current;
        if (!instance || regions.length === 0) {
          return;
        }

        const rect = node.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        // Ensure the mouse is within the chart grid area
        if (!instance.containPixel('grid', [offsetX, offsetY])) {
          hideTooltip();
          return;
        }

        // Convert pixel X to data value (timestamp)
        const dataPoint = instance.convertFromPixel('grid', [offsetX, 0]);
        if (!dataPoint) {
          return;
        }

        // Snap to the closest interval that has abuse data
        const timestamp = dataPoint[0]!;
        let closestTs = 0;
        let closestDist = Infinity;
        for (const ts of valueByTimestamp.keys()) {
          const dist = Math.abs(ts - timestamp);
          if (dist < closestDist) {
            closestDist = dist;
            closestTs = ts;
          }
        }

        const value = valueByTimestamp.get(closestTs);
        if (!value || !regions.some(r => closestTs >= r.start && closestTs <= r.end)) {
          hideTooltip();
          return;
        }

        showTooltip(offsetX, value);
      };

      const handleMouseLeave = () => {
        hideTooltip();
      };

      node.addEventListener('mousemove', handleMouseMove);
      node.addEventListener('mouseleave', handleMouseLeave);

      cleanupRef.current = () => {
        node.removeEventListener('mousemove', handleMouseMove);
        node.removeEventListener('mouseleave', handleMouseLeave);
      };
    }, []);

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

    const abuseIntervals = abuseStats?.intervals ?? intervals;
    const intervalMs =
      abuseIntervals.length >= 2
        ? new Date(abuseIntervals[1]!).getTime() - new Date(abuseIntervals[0]!).getTime()
        : 0;
    const abuseMarkArea = buildAbuseMarkAreaSeries(abuseData.regions, theme, intervalMs);

    const chartSeries = [
      // Abuse markArea first so bars render on top and get mouse events
      ...abuseMarkArea,
      ...populateChartData(intervals, groups, series),
      zeroFillDates(
        zeroFillStart,
        new Date(dataDatetime.end ?? moment().format()).valueOf() / 1000,
        {color: theme.tokens.graphics.accent.moderate}
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
                  <ChartContainer ref={chartContainerRef}>
                    <BarChart
                      ref={chartRef}
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
                    <AbuseTooltip ref={abuseTooltipRef} style={{display: 'none'}} />
                  </ChartContainer>
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

const ChartContainer = styled('div')`
  position: relative;
`;

const AbuseTooltip = styled('div')`
  position: absolute;
  bottom: -${p => p.theme.space.md};
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  font-size: ${p => p.theme.font.size.sm};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.primary};
  pointer-events: none;
  white-space: nowrap;
  z-index: 1;
`;

const Footer = styled('div')`
  display: flex;
  justify-content: space-between;
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  margin: ${p => p.theme.space['2xl']} -${p => p.theme.space.xl} -${p =>
      p.theme.space.xl} -${p => p.theme.space.xl};
  padding: ${p => p.theme.space.xl};
  color: ${p => p.theme.tokens.content.secondary};
`;

const LegendContainer = styled('div')`
  &,
  > div {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: ${p => p.theme.space['3xl']};
  }

  > div {
    gap: ${p => p.theme.space.xs};
  }
`;

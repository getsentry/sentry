import {forwardRef, memo, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import Color from 'color';
import type {SeriesOption} from 'echarts';
import * as echarts from 'echarts/core';
import {CanvasRenderer} from 'echarts/renderers';
import isNil from 'lodash/isNil';
import omitBy from 'lodash/omitBy';

import {transformToAreaSeries} from 'sentry/components/charts/areaChart';
import {transformToBarSeries} from 'sentry/components/charts/barChart';
import BaseChart, {type BaseChartProps} from 'sentry/components/charts/baseChart';
import {
  defaultFormatAxisLabel,
  getFormatter,
} from 'sentry/components/charts/components/tooltip';
import {transformToLineSeries} from 'sentry/components/charts/lineChart';
import ScatterSeries from 'sentry/components/charts/series/scatterSeries';
import ChartZoom from 'sentry/components/charts/useChartZoom';
import {isChartHovered} from 'sentry/components/charts/utils';
import type {
  CombinedMetricChartProps,
  Series,
} from 'sentry/components/metrics/chart/types';
import type {UseFocusAreaResult} from 'sentry/components/metrics/chart/useFocusArea';
import type {UseMetricSamplesResult} from 'sentry/components/metrics/chart/useMetricChartSamples';
import type {UseMetricReleasesResult} from 'sentry/components/metrics/chart/useMetricReleases';
import {t} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import mergeRefs from 'sentry/utils/mergeRefs';
import {formatMetricUsingUnit} from 'sentry/utils/metrics/formatters';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import usePageFilters from 'sentry/utils/usePageFilters';

const MAIN_X_AXIS_ID = 'xAxis';

type ChartProps = {
  displayType: MetricDisplayType;
  series: Series[];
  additionalSeries?: SeriesOption[];
  enableZoom?: boolean;
  focusArea?: UseFocusAreaResult;
  group?: string;
  height?: number;
  releases?: UseMetricReleasesResult;
  samples?: UseMetricSamplesResult;
  showLegend?: boolean;
};

function getLegendProps(showLegend?: boolean): Pick<BaseChartProps, 'legend' | 'grid'> {
  if (showLegend) {
    return {
      legend: {
        show: true,
        left: 0,
        top: 0,
      },
      grid: {
        top: 40,
        bottom: 0,
        left: 0,
        right: 0,
      },
    };
  }

  return {
    grid: {
      top: 5,
      bottom: 0,
      left: 0,
      right: 0,
    },
  };
}

// We need to enable canvas renderer for echarts before we use it here.
// Once we use it in more places, this should probably move to a more global place
// But for now we keep it here to not invluence the bundle size of the main chunks.
echarts.use(CanvasRenderer);

function isNonZeroValue(value: number | undefined) {
  return value !== undefined && value !== 0;
}

function addSeriesPadding(data: Series['data']) {
  const hasNonZeroSibling = (index: number) => {
    return (
      isNonZeroValue(data[index - 1]?.value!) || isNonZeroValue(data[index + 1]?.value)
    );
  };
  const paddingIndices = new Set<number>();
  return {
    data: data.map(({name, value}, index) => {
      const shouldAddPadding = value === null && hasNonZeroSibling(index);
      if (shouldAddPadding) {
        paddingIndices.add(index);
      }
      return {
        name,
        value: shouldAddPadding ? 0 : value,
      };
    }),
    paddingIndices,
  };
}

export const MetricChart = memo(
  forwardRef<ReactEchartsRef, ChartProps>(
    (
      {
        series,
        displayType,
        height,
        group,
        samples,
        focusArea,
        enableZoom,
        releases,
        additionalSeries,
        showLegend,
      },
      forwardedRef
    ) => {
      const chartRef = useRef<ReactEchartsRef>(null);

      const filteredSeries = useMemo(() => series.filter(s => !s.hidden), [series]);

      const firstUnit = filteredSeries[0]?.unit || 'none';
      const uniqueUnits = useMemo(
        () => [...new Set(filteredSeries.map(s => s.unit || 'none'))],
        [filteredSeries]
      );

      useEffect(() => {
        if (!group) {
          return;
        }
        const echartsInstance = chartRef?.current?.getEchartsInstance();
        if (echartsInstance && !echartsInstance.group) {
          echartsInstance.group = group;
        }
      });

      const bucketSize = series[0]?.data[1]?.name! - series[0]?.data[0]?.name!;
      const isSubMinuteBucket = bucketSize < 60_000;
      const lastBucketTimestamp = series[0]?.data[series[0]?.data.length - 1]?.name;
      const ingestionBuckets = useMemo(
        () => getIngestionDelayBucketCount(bucketSize, lastBucketTimestamp!),
        [bucketSize, lastBucketTimestamp]
      );

      const seriesToShow = useMemo(
        () =>
          filteredSeries
            .map(s => {
              const mappedSeries = {
                ...s,
                silent: true,
                yAxisIndex: uniqueUnits.indexOf(s.unit),
                xAxisIndex: 0,
                ...(displayType !== MetricDisplayType.BAR
                  ? addSeriesPadding(s.data)
                  : {data: s.data}),
              };
              if (displayType === MetricDisplayType.BAR) {
                mappedSeries.stack = s.unit;
              }
              return mappedSeries;
            })
            // Split series in two parts, one for the main chart and one for the fog of war
            // The order is important as the tooltip will show the first series first (for overlaps)
            .flatMap(s => createIngestionSeries(s, ingestionBuckets, displayType)),
        [filteredSeries, uniqueUnits, displayType, ingestionBuckets]
      );

      const {selection} = usePageFilters();

      const dateTimeOptions = useMemo(() => {
        return omitBy(selection.datetime, isNil);
      }, [selection.datetime]);

      const chartProps = useMemo(() => {
        const seriesUnits = seriesToShow.reduce(
          (acc, s) => {
            acc[s.seriesName] = s.unit;
            return acc;
          },
          {} as Record<string, string>
        );

        const timeseriesFormatters = {
          valueFormatter: (value: number, seriesName?: string) => {
            const unit = (seriesName && seriesUnits[seriesName]) ?? 'none';
            return formatMetricUsingUnit(value, unit);
          },
          isGroupedByDate: true,
          bucketSize,
          showTimeInTooltip: true,
          addSecondsToTimeFormat: isSubMinuteBucket,
          limit: 10,
          utc: !!dateTimeOptions.utc,
          filter: (_: any, seriesParam: any) => {
            return seriesParam?.axisId === MAIN_X_AXIS_ID;
          },
        };

        const heightOptions = height ? {height} : {autoHeightResize: true};

        let baseChartProps: CombinedMetricChartProps = {
          ...heightOptions,
          ...dateTimeOptions,
          ...getLegendProps(showLegend),
          displayType,
          forwardedRef: mergeRefs([forwardedRef, chartRef]),
          series: seriesToShow,
          devicePixelRatio: 2,
          renderer: 'canvas' as const,
          isGroupedByDate: true,
          colors: seriesToShow.map(s => s.color),
          additionalSeries,
          tooltip: {
            formatter: (params, asyncTicket) => {
              // Only show the tooltip if the current chart is hovered
              // as chart groups trigger the tooltip for all charts in the group when one is hoverered
              if (!isChartHovered(chartRef?.current)) {
                return '';
              }

              // The mechanism by which we display ingestion delay the chart, duplicates the series in the chart data
              // so we need to de-duplicate the series before showing the tooltip
              // this assumes that the first series is the main series and the second is the ingestion delay series
              if (Array.isArray(params)) {
                const uniqueSeries = new Set<string>();
                const deDupedParams = params.filter(param => {
                  // Filter null values from tooltip
                  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  if (param.value[1] === null) {
                    return false;
                  }

                  // scatter series (samples) have their own tooltip
                  if (param.seriesType === 'scatter') {
                    return false;
                  }

                  // Filter padding datapoints from tooltip
                  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  if (param.value[1] === 0) {
                    // @ts-ignore TS(2538): Type 'undefined' cannot be used as an index type.
                    const currentSeries = seriesToShow[param.seriesIndex]!;
                    const paddingIndices =
                      'paddingIndices' in currentSeries
                        ? currentSeries.paddingIndices
                        : undefined;
                    if (paddingIndices?.has(param.dataIndex)) {
                      return false;
                    }
                  }

                  // @ts-ignore TS(2345): Argument of type 'string | undefined' is not assig... Remove this comment to see the full error message
                  if (uniqueSeries.has(param.seriesName)) {
                    return false;
                  }
                  // @ts-ignore TS(2345): Argument of type 'string | undefined' is not assig... Remove this comment to see the full error message
                  uniqueSeries.add(param.seriesName);
                  return true;
                });

                const formattedDate = defaultFormatAxisLabel(
                  (params[0]!.value as any)[0] as number,
                  timeseriesFormatters.isGroupedByDate,
                  timeseriesFormatters.utc,
                  timeseriesFormatters.showTimeInTooltip,
                  timeseriesFormatters.addSecondsToTimeFormat,
                  timeseriesFormatters.bucketSize
                );

                if (deDupedParams.length === 0) {
                  return [
                    '<div class="tooltip-series">',
                    `<center>${t('No data available')}</center>`,
                    '</div>',
                    `<div class="tooltip-footer">${formattedDate}</div>`,
                  ].join('');
                }
                return getFormatter(timeseriesFormatters)(deDupedParams, asyncTicket);
              }
              return getFormatter(timeseriesFormatters)(params, asyncTicket);
            },
          },
          yAxes:
            uniqueUnits.length === 0
              ? // fallback axis for when there are no series as echarts requires at least one axis
                [
                  {
                    id: 'none',
                    axisLabel: {
                      formatter: (value: number) => {
                        return formatMetricUsingUnit(value, 'none');
                      },
                    },
                  },
                ]
              : [
                  ...uniqueUnits.map((unit, index) =>
                    unit === firstUnit
                      ? {
                          id: unit,
                          axisLabel: {
                            formatter: (value: number) => {
                              return formatMetricUsingUnit(value, unit);
                            },
                          },
                        }
                      : {
                          id: unit,
                          show: index === 1,
                          axisLabel: {
                            show: index === 1,
                            formatter: (value: number) => {
                              return formatMetricUsingUnit(value, unit);
                            },
                          },
                          splitLine: {
                            show: false,
                          },
                          position: 'right' as const,
                          axisPointer: {
                            type: 'none' as const,
                          },
                        }
                  ),
                ],
          xAxes: [
            {
              id: MAIN_X_AXIS_ID,
              axisPointer: {
                snap: true,
              },
            },
          ],
        };

        if (samples?.applyChartProps) {
          baseChartProps = samples.applyChartProps(baseChartProps);
        }

        if (releases?.applyChartProps) {
          baseChartProps = releases.applyChartProps(baseChartProps);
        }

        // Apply focus area props as last so it can disable tooltips
        if (focusArea?.applyChartProps) {
          baseChartProps = focusArea.applyChartProps(baseChartProps);
        }

        return baseChartProps;
      }, [
        seriesToShow,
        dateTimeOptions,
        bucketSize,
        isSubMinuteBucket,
        height,
        displayType,
        forwardedRef,
        uniqueUnits,
        samples,
        focusArea,
        releases,
        firstUnit,
        additionalSeries,
        showLegend,
      ]);

      if (!enableZoom) {
        return (
          <ChartWrapper>
            {focusArea?.overlay}
            <CombinedChart {...chartProps} />
          </ChartWrapper>
        );
      }
      return (
        <ChartWrapper>
          <ChartZoom>
            {zoomRenderProps => <CombinedChart {...chartProps} {...zoomRenderProps} />}
          </ChartZoom>
        </ChartWrapper>
      );
    }
  )
);

function CombinedChart({
  displayType,
  series,
  scatterSeries = [],
  additionalSeries = [],
  ...chartProps
}: CombinedMetricChartProps) {
  const combinedSeries = useMemo(() => {
    if (displayType === MetricDisplayType.LINE) {
      return [
        ...transformToLineSeries({series}),
        ...transformToScatterSeries({series: scatterSeries, displayType}),
        ...additionalSeries,
      ];
    }

    if (displayType === MetricDisplayType.BAR) {
      return [
        ...transformToBarSeries({series, stacked: true, animation: false}),
        ...transformToScatterSeries({series: scatterSeries, displayType}),
        ...additionalSeries,
      ];
    }

    if (displayType === MetricDisplayType.AREA) {
      return [
        ...transformToAreaSeries({series, stacked: true, colors: chartProps.colors}),
        ...transformToScatterSeries({series: scatterSeries, displayType}),
        ...additionalSeries,
      ];
    }

    return [];
  }, [displayType, series, scatterSeries, additionalSeries, chartProps.colors]);

  return <BaseChart {...chartProps} series={combinedSeries} />;
}

function transformToScatterSeries({
  series,
  displayType,
}: {
  displayType: MetricDisplayType;
  series: Series[];
}) {
  return series.map(({seriesName, data: seriesData, ...options}) => {
    if (displayType === MetricDisplayType.BAR) {
      return ScatterSeries({
        ...options,
        name: seriesName,
        data: seriesData?.map(({value, name}) => ({value: [name, value]})),
      });
    }

    return ScatterSeries({
      ...options,
      name: seriesName,
      data: seriesData?.map(({value, name}) => [name, value]),
      animation: false,
    });
  });
}

export function createIngestionSeries(
  orignalSeries: Series,
  ingestionBuckets: number,
  displayType: MetricDisplayType
) {
  if (ingestionBuckets < 1) {
    return [orignalSeries];
  }

  const series = [
    {
      ...orignalSeries,
      data: orignalSeries.data.slice(0, -ingestionBuckets),
    },
  ];

  if (displayType === MetricDisplayType.BAR) {
    series.push(createIngestionBarSeries(orignalSeries, ingestionBuckets));
  } else if (displayType === MetricDisplayType.AREA) {
    series.push(createIngestionAreaSeries(orignalSeries, ingestionBuckets));
  } else {
    series.push(createIngestionLineSeries(orignalSeries, ingestionBuckets));
  }

  return series;
}

const EXTRAPOLATED_AREA_STRIPE_IMG =
  'image://data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAABkCAYAAAC/zKGXAAAAMUlEQVR4Ae3KoREAIAwEsMKgrMeYj8BzyIpEZyTZda16mPVJFEVRFEVRFEVRFMWO8QB4uATKpuU51gAAAABJRU5ErkJggg==';

export const getIngestionSeriesId = (seriesId: string) => `${seriesId}-ingestion`;

function createIngestionBarSeries(series: Series, fogBucketCnt = 0) {
  return {
    ...series,
    id: getIngestionSeriesId(series.id),
    silent: true,
    data: series.data.map((data, index) => ({
      ...data,
      // W need to set a value for the non-fog of war buckets so that the stacking still works in echarts
      value: index < series.data.length - fogBucketCnt ? 0 : data.value,
    })),
    itemStyle: {
      opacity: 1,
      decal: {
        symbol: EXTRAPOLATED_AREA_STRIPE_IMG,
        dashArrayX: [6, 0],
        dashArrayY: [6, 0],
        rotation: Math.PI / 4,
      },
    },
  };
}

function createIngestionLineSeries(series: Series, fogBucketCnt = 0) {
  return {
    ...series,
    id: getIngestionSeriesId(series.id),
    silent: true,
    // We include the last non-fog of war bucket so that the line is connected
    data: series.data.slice(-fogBucketCnt - 1),
    lineStyle: {
      type: 'dotted',
    },
  };
}

function createIngestionAreaSeries(series: Series, fogBucketCnt = 0) {
  return {
    ...series,
    id: getIngestionSeriesId(series.id),
    silent: true,
    stack: 'fogOfWar',
    // We include the last non-fog of war bucket so that the line is connected
    data: series.data.slice(-fogBucketCnt - 1),
    lineStyle: {
      type: 'dotted',
      color: Color(series.color).lighten(0.3).string(),
    },
  };
}

const AVERAGE_INGESTION_DELAY_MS = 90_000;
/**
 * Calculates the number of buckets, affected by ingestion delay.
 * Based on the AVERAGE_INGESTION_DELAY_MS
 * @param bucketSize in ms
 * @param lastBucketTimestamp starting time of the last bucket in ms
 */
export function getIngestionDelayBucketCount(
  bucketSize: number,
  lastBucketTimestamp: number
) {
  const timeSinceLastBucket = Date.now() - (lastBucketTimestamp + bucketSize);
  const ingestionAffectedTime = Math.max(
    0,
    AVERAGE_INGESTION_DELAY_MS - timeSinceLastBucket
  );

  return Math.ceil(ingestionAffectedTime / bucketSize);
}

const ChartWrapper = styled('div')`
  position: relative;
  height: 100%;
`;

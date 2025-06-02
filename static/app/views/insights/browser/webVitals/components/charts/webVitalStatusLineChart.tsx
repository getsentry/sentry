import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LineSeriesOption, SeriesOption} from 'echarts';
import type {ItemStyleOption} from 'echarts/types/src/util/types';

import {getInterval} from 'sentry/components/charts/utils';
import getDuration from 'sentry/utils/duration/getDuration';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {TimeSeriesValueUnit} from 'sentry/views/dashboards/widgets/common/types';
import type {
  Plottable,
  PlottableTimeSeriesValueType,
} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {
  PERFORMANCE_SCORE_MEDIANS,
  PERFORMANCE_SCORE_P90S,
} from 'sentry/views/insights/browser/webVitals/utils/scoreThresholds';
import {useDefaultWebVitalsQuery} from 'sentry/views/insights/browser/webVitals/utils/useDefaultQuery';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {useMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import type {SubregionCode} from 'sentry/views/insights/types';
import {SpanIndexedField} from 'sentry/views/insights/types';

interface Props {
  webVital: WebVitals | null;
  browserTypes?: BrowserType[];
  subregions?: SubregionCode[];
  transaction?: string;
}

export function WebVitalStatusLineChart({
  webVital,
  transaction,
  browserTypes,
  subregions,
}: Props) {
  const theme = useTheme();
  const pageFilters = usePageFilters();
  const defaultQuery = useDefaultWebVitalsQuery();

  const search = new MutableSearch(defaultQuery);

  if (transaction) {
    search.addFilterValue('transaction', transaction);
  }
  if (browserTypes) {
    search.addDisjunctionFilterValues(SpanIndexedField.BROWSER_NAME, browserTypes);
  }
  if (subregions) {
    search.addDisjunctionFilterValues(SpanIndexedField.USER_GEO_SUBREGION, subregions);
  }

  const {
    data: timeseriesData,
    isLoading: isTimeseriesLoading,
    error: timeseriesError,
  } = useMetricsSeries(
    {
      search,
      interval: getInterval(pageFilters.selection.datetime, 'low'),
      yAxis: webVital ? [`p75(measurements.${webVital})`] : [],
      enabled: !!webVital,
    },
    'api.performance.browser.web-vitals.timeseries'
  );

  // const webVitalSeries: DiscoverSeries = {
  //   data:
  //     !isTimeseriesLoading && webVital
  //       ? timeseriesData?.[`p75(measurements.${webVital})`].data.map(({name, value}) => ({
  //           name,
  //           value,
  //         }))
  //       : [],
  //   seriesName: webVital ?? '',
  //   meta:
  //     webVital && timeseriesData[`p75(measurements.${webVital})`].meta
  //       ? timeseriesData[`p75(measurements.${webVital})`].meta
  //       : {fields: {}, units: {}},
  // };

  const webVitalSeries: DiscoverSeries = webVital
    ? timeseriesData?.[`p75(measurements.${webVital})`]
    : {data: [], meta: {fields: {}, units: {}}, seriesName: ''};

  const seriesIsPoor = webVitalSeries.data?.some(
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    ({value}) => value > PERFORMANCE_SCORE_MEDIANS[webVital ?? '']
  );
  const seriesIsMeh = webVitalSeries.data?.some(
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    ({value}) => value >= PERFORMANCE_SCORE_P90S[webVital ?? '']
  );
  const seriesIsGood = webVitalSeries.data?.every(
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    ({value}) => value < PERFORMANCE_SCORE_P90S[webVital ?? '']
  );
  // const goodMarkArea: MarkAreaOption = {
  //   silent: true,
  //   itemStyle: {
  //     color: theme.green300,
  //     opacity: 0.1,
  //   },
  //   data: [
  //     [
  //       {
  //         // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  //         yAxis: PERFORMANCE_SCORE_P90S[webVital ?? ''],
  //       },
  //       {
  //         yAxis: 0,
  //       },
  //     ],
  //   ],
  // };

  // const mehMarkArea = MarkArea({
  //   silent: true,
  //   itemStyle: {
  //     color: theme.yellow300,
  //     opacity: 0.1,
  //   },
  //   data: [
  //     [
  //       {
  //         // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  //         yAxis: PERFORMANCE_SCORE_MEDIANS[webVital ?? ''],
  //       },
  //       {
  //         // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  //         yAxis: PERFORMANCE_SCORE_P90S[webVital ?? ''],
  //       },
  //     ],
  //   ],
  // });
  // const poorMarkArea = MarkArea({
  //   silent: true,
  //   itemStyle: {
  //     color: theme.red300,
  //     opacity: 0.1,
  //   },
  //   data: [
  //     [
  //       {
  //         // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  //         yAxis: PERFORMANCE_SCORE_MEDIANS[webVital ?? ''],
  //       },
  //       {
  //         yAxis: Infinity,
  //       },
  //     ],
  //   ],
  // });
  // const goodMarkLine = MarkLine({
  //   silent: true,
  //   lineStyle: {
  //     color: theme.green300,
  //   },
  //   label: {
  //     formatter: () => 'Good',
  //     position: 'insideEndBottom',
  //     color: theme.green300,
  //   },
  //   data: [
  //     {
  //       // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  //       yAxis: PERFORMANCE_SCORE_P90S[webVital ?? ''],
  //     },
  //   ],
  // });
  // const mehMarkLine = MarkLine({
  //   silent: true,
  //   lineStyle: {
  //     color: theme.yellow300,
  //   },
  //   label: {
  //     formatter: () => 'Meh',
  //     position: 'insideEndBottom',
  //     color: theme.yellow300,
  //   },
  //   data: [
  //     {
  //       // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  //       yAxis: PERFORMANCE_SCORE_MEDIANS[webVital ?? ''],
  //     },
  //   ],
  // });
  // const poorMarkLine = MarkLine({
  //   silent: true,
  //   lineStyle: {
  //     color: theme.red300,
  //   },
  //   label: {
  //     formatter: () => 'Poor',
  //     position: 'insideEndBottom',
  //     color: theme.red300,
  //   },
  //   data: [
  //     [
  //       {xAxis: 'min', y: 10},
  //       {xAxis: 'max', y: 10},
  //     ],
  //   ],
  // });

  // allSeries.push({
  //   seriesName: '',
  //   type: 'line',
  //   markArea: goodMarkArea,
  //   data: [],
  // });

  // allSeries.push({
  //   seriesName: '',
  //   type: 'line',
  //   markArea: mehMarkArea,
  //   data: [],
  // });

  // allSeries.push({
  //   seriesName: '',
  //   type: 'line',
  //   markArea: poorMarkArea,
  //   data: [],
  // });

  // allSeries.push({
  //   seriesName: '',
  //   type: 'line',
  //   markLine: goodMarkLine,
  //   data: [],
  // });

  // allSeries.push({
  //   seriesName: '',
  //   type: 'line',
  //   markLine: mehMarkLine,
  //   data: [],
  // });

  // if (seriesIsPoor) {
  //   allSeries.push({
  //     seriesName: '',
  //     type: 'line',
  //     markLine: poorMarkLine,
  //     data: [],
  //   });
  // }

  const getFormattedDuration = (value: number) => {
    if (value < 1000) {
      return getDuration(value / 1000, 0, true);
    }
    return getDuration(value / 1000, 2, true);
  };

  const getMaxYAxis = () => {
    if (seriesIsPoor) {
      return undefined;
    }
    if (seriesIsMeh) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      return PERFORMANCE_SCORE_MEDIANS[webVital ?? ''];
    }
    if (seriesIsGood) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      return PERFORMANCE_SCORE_P90S[webVital ?? ''];
    }
    return undefined;
  };

  const yAxisMax = getMaxYAxis();

  const goodMarkAreaPlottable = new MarkAreaPlottable({
    yAxisRange: [0, webVital ? PERFORMANCE_SCORE_P90S[webVital] : 0],
    style: {
      color: theme.green300,
      opacity: 0.1,
    },
  });

  const extraPlottables: Plottable[] = [goodMarkAreaPlottable];

  return (
    <ChartContainer>
      {webVital && (
        <InsightsLineChartWidget
          title={webVital}
          showReleaseAs="none"
          isLoading={isTimeseriesLoading}
          error={timeseriesError}
          series={[webVitalSeries]}
          extraPlottables={extraPlottables}
          search={search}
        />
      )}
    </ChartContainer>
  );

  // return (
  //   <ChartContainer>
  //     {webVital && (
  //       <ChartZoom period={period} start={start} end={end} utc={utc}>
  //         {zoomRenderProps => (
  //           <LineChart
  //             {...zoomRenderProps}
  //             height={240}
  //             series={allSeries}
  //             xAxis={{show: false}}
  //             grid={{
  //               left: 0,
  //               right: 15,
  //               top: 10,
  //               bottom: 0,
  //             }}
  //             yAxis={{
  //               ...(webVital === 'cls'
  //                 ? {}
  //                 : {axisLabel: {formatter: getFormattedDuration}}),
  //               max: yAxisMax,
  //             }}
  //             tooltip={webVital === 'cls' ? {} : {valueFormatter: getFormattedDuration}}
  //           />
  //         )}
  //       </ChartZoom>
  //     )}
  //   </ChartContainer>
  // );
}

const ChartContainer = styled('div')`
  position: relative;
  flex: 1;
`;

// class MarkAreaPlottable extends Line implements Plottable {
//   markArea: MarkAreaOption;

//   constructor(markArea: MarkAreaOption) {
//     super({
//       timeSeries: {
//         data: [],
//         meta: {fields: {}, units: {}},
//         seriesName: '',
//       },
//     });
// }

class MarkAreaPlottable implements Plottable {
  markArea: LineSeriesOption['markArea'];
  dataType: PlottableTimeSeriesValueType = 'number';
  dataUnit: TimeSeriesValueUnit = null;
  isEmpty = false;
  name = '';
  needsColor = false;
  start: number | null = null;
  end: number | null = null;

  constructor({
    yAxisRange,
    style,
  }: {
    yAxisRange: [number, number];
    style?: ItemStyleOption;
  }) {
    this.markArea = {
      itemStyle: style,
      data: [
        {
          yAxis: yAxisRange[0],
        },
        {
          yAxis: yAxisRange[1],
        },
      ],
    };

    this.isEmpty = yAxisRange[0] === yAxisRange[1];
  }

  toSeries(): SeriesOption[] {
    const seriesOption: LineSeriesOption = {
      type: 'line',
      data: [],
      markArea: this.markArea,
    };

    return [seriesOption];
  }
}

// class MarkLinePlottable implements Plottable {
//   markLine: MarkLineOption;

//   constructor(markLine: MarkLineOption['markLine']) {
//     this.markLine = markLine;
//   }

//   toSeries(plottingOptions: unknown): SeriesOption[] {
//     const seriesOption: LineSeriesOption = {
//       type: 'line',
//       data: [this.markLine.value],
//       markLine: this.markLine,
//     };

//     return [seriesOption];
//   }
// }

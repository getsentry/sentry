import type {LineSeriesOption, YAXisComponentOption} from 'echarts';

import type {AreaChartSeries} from 'sentry/components/charts/areaChart';
import XAxis from 'sentry/components/charts/components/xAxis';
import AreaSeries from 'sentry/components/charts/series/areaSeries';
import type {SessionApiResponse} from 'sentry/types';
import {lightTheme as theme} from 'sentry/utils/theme';
import type {MetricChartData} from 'sentry/views/alerts/rules/metric/details/metricChartOption';
import {
  getMetricAlertChartOption,
  transformSessionResponseToSeries,
} from 'sentry/views/alerts/rules/metric/details/metricChartOption';

import {DEFAULT_FONT_FAMILY, slackChartDefaults, slackChartSize} from './slack';
import type {RenderDescriptor} from './types';
import {ChartType} from './types';
import {
  BreakpointChartData,
  getBreakPointChartPropsFromData,
} from 'sentry/components/events/eventStatisticalDetector/breakpointChart';

const metricAlertXaxis = XAxis({
  theme,
  splitNumber: 3,
  isGroupedByDate: true,
  axisLabel: {fontSize: 11, fontFamily: DEFAULT_FONT_FAMILY},
});
const metricAlertYaxis: YAXisComponentOption = {
  axisLabel: {fontSize: 11, fontFamily: DEFAULT_FONT_FAMILY},
  splitLine: {
    lineStyle: {
      color: theme.chartLineColor,
      opacity: 0.3,
    },
  },
};

function transformAreaSeries(series: AreaChartSeries[]): LineSeriesOption[] {
  return series.map(({seriesName, data, ...otherSeriesProps}) => {
    const areaSeries = AreaSeries({
      name: seriesName,
      data: data.map(({name, value}) => [name, value]),
      lineStyle: {
        opacity: 1,
        width: 0.4,
      },
      areaStyle: {
        opacity: 1.0,
      },
      animation: false,
      animationThreshold: 1,
      animationDuration: 0,
      ...otherSeriesProps,
    });

    // Fix incident label font family, cannot use Rubik
    if (areaSeries.markLine?.label) {
      areaSeries.markLine.label.fontFamily = DEFAULT_FONT_FAMILY;
    }

    return areaSeries;
  });
}

export const performanceCharts: RenderDescriptor<ChartType>[] = [];

/*
interface EChartsOption extends ECBasicOption {
    dataset?: DatasetOption | DatasetOption[];
    aria?: AriaOption;
    title?: TitleOption | TitleOption[];
    grid?: GridOption | GridOption[];
    radar?: RadarOption | RadarOption[];
    polar?: PolarOption | PolarOption[];
    geo?: GeoOption | GeoOption[];
    angleAxis?: AngleAxisOption | AngleAxisOption[];
    radiusAxis?: RadiusAxisOption | RadiusAxisOption[];
    xAxis?: XAXisOption | XAXisOption[];
    yAxis?: YAXisOption | YAXisOption[];
    singleAxis?: SingleAxisOption | SingleAxisOption[];
    parallel?: ParallelCoordinateSystemOption | ParallelCoordinateSystemOption[];
    parallelAxis?: ParallelAxisOption | ParallelAxisOption[];
    calendar?: CalendarOption | CalendarOption[];
    toolbox?: ToolboxComponentOption | ToolboxComponentOption[];
    tooltip?: TooltipOption | TooltipOption[];
    axisPointer?: AxisPointerOption | AxisPointerOption[];
    brush?: BrushOption | BrushOption[];
    timeline?: TimelineOption | SliderTimelineOption;
    legend?: LegendComponentOption | (LegendComponentOption)[];
    dataZoom?: DataZoomComponentOption |(DataZoomComponentOption)[];
    visualMap?: VisualMapComponentOption | (VisualMapComponentOption)[];
    graphic?: GraphicComponentLooseOption | GraphicComponentLooseOption[];
    series?: SeriesOption$1 | SeriesOption$1[];
    options?: EChartsOption[];
    baseOption?: EChartsOption;
}
*/
performanceCharts.push({
  key: ChartType.SLACK_PERFORMANCE_ENDPOINT_REGRESSION,
  getOption: (data: BreakpointChartData) => {
    const {chartOption} = getBreakPointChartPropsFromData(data);

    return {
      ...chartOption,
      backgroundColor: theme.background,
      series: transformAreaSeries(chartOption.series),
      xAxis: metricAlertXaxis,
      yAxis: {
        ...chartOption.yAxis,
        ...metricAlertYaxis,
        axisLabel: {
          ...chartOption.yAxis!.axisLabel,
          ...metricAlertYaxis.axisLabel,
        },
      },
      grid: slackChartDefaults.grid,
    };
  },
  ...slackChartSize,
});

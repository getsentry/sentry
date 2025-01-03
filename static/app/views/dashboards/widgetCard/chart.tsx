import type React from 'react';
import {Component} from 'react';
import type {Theme} from '@emotion/react';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LegendComponentOption} from 'echarts';
import type {Location} from 'history';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {BarChart} from 'sentry/components/charts/barChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {LineChart} from 'sentry/components/charts/lineChart';
import ReleaseSeries from 'sentry/components/charts/releaseSeries';
import SimpleTableChart from 'sentry/components/charts/simpleTableChart';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {getSeriesSelection, isChartHovered} from 'sentry/components/charts/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {PlaceholderProps} from 'sentry/components/placeholder';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {
  EChartDataZoomHandler,
  EChartEventHandler,
  ReactEchartsRef,
} from 'sentry/types/echarts';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {
  axisLabelFormatter,
  axisLabelFormatterUsingAggregateOutputType,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {
  aggregateOutputType,
  getAggregateArg,
  getEquation,
  getMeasurementSlug,
  isEquation,
  maybeEquationAlias,
  stripDerivedMetricsPrefix,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import getDynamicText from 'sentry/utils/getDynamicText';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {getBucketSize} from 'sentry/views/dashboards/widgetCard/utils';
import WidgetLegendNameEncoderDecoder from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';

import {getFormatter} from '../../../components/charts/components/tooltip';
import {getDatasetConfig} from '../datasetConfig/base';
import type {Widget} from '../types';
import {DisplayType} from '../types';
import type WidgetLegendSelectionState from '../widgetLegendSelectionState';
import {BigNumberWidgetVisualization} from '../widgets/bigNumberWidget/bigNumberWidgetVisualization';

import type {GenericWidgetQueriesChildrenProps} from './genericWidgetQueries';

const OTHER = 'Other';
const PERCENTAGE_DECIMAL_POINTS = 3;

type TableResultProps = Pick<
  GenericWidgetQueriesChildrenProps,
  'errorMessage' | 'loading' | 'tableResults'
>;

type WidgetCardChartProps = Pick<
  GenericWidgetQueriesChildrenProps,
  'timeseriesResults' | 'tableResults' | 'errorMessage' | 'loading'
> & {
  location: Location;
  organization: Organization;
  selection: PageFilters;
  theme: Theme;
  widget: Widget;
  widgetLegendState: WidgetLegendSelectionState;
  chartGroup?: string;
  expandNumbers?: boolean;
  isMobile?: boolean;
  legendOptions?: LegendComponentOption;
  noPadding?: boolean;
  onLegendSelectChanged?: EChartEventHandler<{
    name: string;
    selected: Record<string, boolean>;
    type: 'legendselectchanged';
  }>;
  onZoom?: EChartDataZoomHandler;
  shouldResize?: boolean;
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  windowWidth?: number;
};

class WidgetCardChart extends Component<WidgetCardChartProps> {
  shouldComponentUpdate(nextProps: WidgetCardChartProps): boolean {
    if (
      this.props.widget.displayType === DisplayType.BIG_NUMBER &&
      nextProps.widget.displayType === DisplayType.BIG_NUMBER &&
      (this.props.windowWidth !== nextProps.windowWidth ||
        !isEqual(this.props.widget?.layout, nextProps.widget?.layout))
    ) {
      return true;
    }

    // Widget title changes should not update the WidgetCardChart component tree
    const currentProps = {
      ...omit(this.props, ['windowWidth']),
      widget: {
        ...this.props.widget,
        title: '',
      },
    };

    nextProps = {
      ...omit(nextProps, ['windowWidth']),
      widget: {
        ...nextProps.widget,
        title: '',
      },
    };

    return !isEqual(currentProps, nextProps);
  }

  tableResultComponent({
    loading,
    errorMessage,
    tableResults,
  }: TableResultProps): React.ReactNode {
    const {location, widget, selection} = this.props;
    if (errorMessage) {
      return (
        <StyledErrorPanel>
          <IconWarning color="gray500" size="lg" />
        </StyledErrorPanel>
      );
    }

    if (typeof tableResults === 'undefined') {
      // Align height to other charts.
      return <LoadingPlaceholder />;
    }

    const datasetConfig = getDatasetConfig(widget.widgetType);

    return tableResults.map((result, i) => {
      const fields = widget.queries[i]?.fields?.map(stripDerivedMetricsPrefix) ?? [];
      const fieldAliases = widget.queries[i]?.fieldAliases ?? [];
      const eventView = eventViewFromWidget(widget.title, widget.queries[0]!, selection);

      return (
        <TableWrapper key={`table:${result.title}`}>
          <StyledSimpleTableChart
            eventView={eventView}
            fieldAliases={fieldAliases}
            location={location}
            fields={fields}
            title={tableResults.length > 1 ? result.title : ''}
            loading={loading}
            loader={<LoadingPlaceholder />}
            metadata={result.meta}
            data={result.data}
            stickyHeaders
            fieldHeaderMap={datasetConfig.getFieldHeaderMap?.(widget.queries[i])}
            getCustomFieldRenderer={datasetConfig.getCustomFieldRenderer}
          />
        </TableWrapper>
      );
    });
  }

  bigNumberComponent({
    loading,
    errorMessage,
    tableResults,
  }: TableResultProps): React.ReactNode {
    if (errorMessage) {
      return (
        <StyledErrorPanel>
          <IconWarning color="gray500" size="lg" />
        </StyledErrorPanel>
      );
    }

    if (typeof tableResults === 'undefined' || loading) {
      return <BigNumber>{'\u2014'}</BigNumber>;
    }

    const {widget} = this.props;

    return tableResults.map((result, i) => {
      const tableMeta = {...result.meta};
      const fields = Object.keys(tableMeta?.fields ?? {});

      let field = fields[0]!;
      let selectedField = field;

      if (defined(widget.queries[0]!.selectedAggregate)) {
        const index = widget.queries[0]!.selectedAggregate;
        selectedField = widget.queries[0]!.aggregates[index]!;
        if (fields.includes(selectedField)) {
          field = selectedField;
        }
      }

      const data = result?.data;
      const meta = result?.meta as EventsMetaType;
      const value = data?.[0]?.[selectedField];

      if (
        !field ||
        !result.data?.length ||
        selectedField === 'equation|' ||
        selectedField === '' ||
        !defined(value) ||
        !Number.isFinite(value) ||
        Number.isNaN(value)
      ) {
        return <BigNumber key={`big_number:${result.title}`}>{'\u2014'}</BigNumber>;
      }

      return (
        <BigNumberWidgetVisualization
          key={i}
          field={field}
          value={value}
          meta={meta}
          thresholds={widget.thresholds ?? undefined}
          preferredPolarity="-"
        />
      );
    });
  }

  chartRef: ReactEchartsRef | null = null;

  handleRef = (chartRef: ReactEchartsRef): void => {
    if (chartRef && !this.chartRef) {
      this.chartRef = chartRef;
      // add chart to the group so that it has synced cursors
      const instance = chartRef.getEchartsInstance?.();
      if (instance && !instance.group && this.props.chartGroup) {
        instance.group = this.props.chartGroup;
      }
    }

    if (!chartRef) {
      this.chartRef = null;
    }
  };

  chartComponent(chartProps): React.ReactNode {
    const {widget} = this.props;
    const stacked = widget.queries[0]!?.columns.length > 0;

    switch (widget.displayType) {
      case 'bar':
        return <BarChart {...chartProps} stacked={stacked} animation={false} />;
      case 'area':
      case 'top_n':
        return <AreaChart stacked {...chartProps} />;
      case 'line':
      default:
        return <LineChart {...chartProps} />;
    }
  }

  render() {
    const {
      theme,
      tableResults,
      timeseriesResults,
      errorMessage,
      loading,
      widget,
      onZoom,
      legendOptions,
      noPadding,
      timeseriesResultsTypes,
      shouldResize,
    } = this.props;

    if (widget.displayType === 'table') {
      return getDynamicText({
        value: (
          <TransitionChart loading={loading} reloading={loading}>
            <LoadingScreen loading={loading} />
            {this.tableResultComponent({tableResults, loading, errorMessage})}
          </TransitionChart>
        ),
        fixed: <Placeholder height="200px" testId="skeleton-ui" />,
      });
    }

    if (widget.displayType === 'big_number') {
      return (
        <TransitionChart loading={loading} reloading={loading}>
          <LoadingScreen loading={loading} />
          <BigNumberResizeWrapper>
            {this.bigNumberComponent({tableResults, loading, errorMessage})}
          </BigNumberResizeWrapper>
        </TransitionChart>
      );
    }

    if (errorMessage) {
      return (
        <StyledErrorPanel>
          <IconWarning color="gray500" size="lg" />
        </StyledErrorPanel>
      );
    }

    const {location, selection, onLegendSelectChanged, widgetLegendState} = this.props;
    const {start, end, period, utc} = selection.datetime;
    const {projects, environments} = selection;

    const legend = {
      left: 0,
      top: 0,
      selected: getSeriesSelection(location),
      formatter: (seriesName: string) => {
        seriesName =
          WidgetLegendNameEncoderDecoder.decodeSeriesNameForLegend(seriesName)!;
        const arg = getAggregateArg(seriesName);
        if (arg !== null) {
          const slug = getMeasurementSlug(arg);
          if (slug !== null) {
            seriesName = slug.toUpperCase();
          }
        }
        if (maybeEquationAlias(seriesName)) {
          seriesName = stripEquationPrefix(seriesName);
        }
        return seriesName;
      },
      ...legendOptions,
    };

    const axisField = widget.queries[0]?.aggregates?.[0] ?? 'count()';
    const axisLabel = isEquation(axisField) ? getEquation(axisField) : axisField;

    // Check to see if all series output types are the same. If not, then default to number.
    const outputType =
      timeseriesResultsTypes && new Set(Object.values(timeseriesResultsTypes)).size === 1
        ? timeseriesResultsTypes[axisLabel]!
        : 'number';
    const isDurationChart = outputType === 'duration';
    const durationUnit = isDurationChart
      ? timeseriesResults && getDurationUnit(timeseriesResults, legendOptions)
      : undefined;
    const bucketSize = getBucketSize(timeseriesResults);

    const valueFormatter = (value: number, seriesName?: string) => {
      const decodedSeriesName = seriesName
        ? WidgetLegendNameEncoderDecoder.decodeSeriesNameForLegend(seriesName)
        : seriesName;
      const aggregateName = decodedSeriesName?.split(':').pop()?.trim();
      if (aggregateName) {
        return timeseriesResultsTypes
          ? tooltipFormatter(value, timeseriesResultsTypes[aggregateName])
          : tooltipFormatter(value, aggregateOutputType(aggregateName));
      }
      return tooltipFormatter(value, 'number');
    };

    const nameFormatter = (name: string) => {
      return WidgetLegendNameEncoderDecoder.decodeSeriesNameForLegend(name)!;
    };

    const chartOptions = {
      autoHeightResize: shouldResize ?? true,
      useMultilineDate: true,
      grid: {
        left: 0,
        right: 4,
        top: '40px',
        bottom: 0,
      },
      seriesOptions: {
        showSymbol: false,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        formatter: (params, asyncTicket) => {
          const {chartGroup} = this.props;
          const isInGroup =
            chartGroup && chartGroup === this.chartRef?.getEchartsInstance().group;

          // tooltip is triggered whenever any chart in the group is hovered,
          // so we need to check if the mouse is actually over this chart
          if (isInGroup && !isChartHovered(this.chartRef)) {
            return '';
          }

          return getFormatter({
            valueFormatter,
            nameFormatter,
            isGroupedByDate: true,
            bucketSize,
            addSecondsToTimeFormat: false,
            showTimeInTooltip: true,
          })(params, asyncTicket);
        },
      },
      yAxis: {
        axisLabel: {
          color: theme.chartLabel,
          formatter: (value: number) => {
            if (timeseriesResultsTypes) {
              return axisLabelFormatterUsingAggregateOutputType(
                value,
                outputType,
                true,
                durationUnit,
                undefined,
                PERCENTAGE_DECIMAL_POINTS
              );
            }
            return axisLabelFormatter(
              value,
              aggregateOutputType(axisLabel),
              true,
              undefined,
              undefined,
              PERCENTAGE_DECIMAL_POINTS
            );
          },
        },
        axisPointer: {
          type: 'line',
          snap: false,
          lineStyle: {
            type: 'solid',
            width: 0.5,
          },
          label: {
            show: false,
          },
        },
        minInterval: durationUnit ?? 0,
      },
      xAxis: {
        axisPointer: {
          snap: true,
        },
      },
    };

    return (
      <ChartZoom period={period} start={start} end={end} utc={utc}>
        {zoomRenderProps => {
          if (errorMessage) {
            return (
              <StyledErrorPanel>
                <IconWarning color="gray500" size="lg" />
              </StyledErrorPanel>
            );
          }

          const otherRegex = new RegExp(`(?:.* : ${OTHER}$)|^${OTHER}$`);
          const shouldColorOther = timeseriesResults?.some(({seriesName}) =>
            seriesName?.match(otherRegex)
          );
          const colors = timeseriesResults
            ? theme.charts.getColorPalette(
                timeseriesResults.length - (shouldColorOther ? 3 : 2)
              )
            : [];
          // TODO(wmak): Need to change this when updating dashboards to support variable topEvents
          if (shouldColorOther) {
            colors[colors.length] = theme.chartOther;
          }

          // Create a list of series based on the order of the fields,
          const series = timeseriesResults
            ? timeseriesResults
                .map((values, i: number) => {
                  let seriesName = '';
                  if (values.seriesName !== undefined) {
                    seriesName = isEquation(values.seriesName)
                      ? getEquation(values.seriesName)
                      : values.seriesName;
                  }
                  return {
                    ...values,
                    seriesName,
                    color: colors[i],
                  };
                })
                .filter(Boolean) // NOTE: `timeseriesResults` is a sparse array! We have to filter out the empty slots after the colors are assigned, since the colors are assigned based on sparse array index
            : [];

          const forwardedRef = this.props.chartGroup ? this.handleRef : undefined;

          return widgetLegendState.widgetRequiresLegendUnselection(widget) ? (
            <ReleaseSeries
              end={end}
              start={start}
              period={period}
              environments={environments}
              projects={projects}
              memoized
            >
              {({releaseSeries}) => {
                // make series name into seriesName:widgetId form for individual widget legend control
                // NOTE: e-charts legends control all charts that have the same series name so attaching
                // widget id will differentiate the charts allowing them to be controlled individually
                const modifiedReleaseSeriesResults =
                  WidgetLegendNameEncoderDecoder.modifyTimeseriesNames(
                    widget,
                    releaseSeries
                  );
                return (
                  <TransitionChart loading={loading} reloading={loading}>
                    <LoadingScreen loading={loading} />
                    <ChartWrapper
                      autoHeightResize={shouldResize ?? true}
                      noPadding={noPadding}
                    >
                      {getDynamicText({
                        value: this.chartComponent({
                          ...zoomRenderProps,
                          ...chartOptions,
                          // Override default datazoom behaviour for updating Global Selection Header
                          ...(onZoom ? {onDataZoom: onZoom} : {}),
                          legend,
                          series: [...series, ...(modifiedReleaseSeriesResults ?? [])],
                          onLegendSelectChanged,
                          forwardedRef,
                        }),
                        fixed: <Placeholder height="200px" testId="skeleton-ui" />,
                      })}
                    </ChartWrapper>
                  </TransitionChart>
                );
              }}
            </ReleaseSeries>
          ) : (
            <TransitionChart loading={loading} reloading={loading}>
              <LoadingScreen loading={loading} />
              <ChartWrapper autoHeightResize={shouldResize ?? true} noPadding={noPadding}>
                {getDynamicText({
                  value: this.chartComponent({
                    ...zoomRenderProps,
                    ...chartOptions,
                    // Override default datazoom behaviour for updating Global Selection Header
                    ...(onZoom ? {onDataZoom: onZoom} : {}),
                    legend,
                    series,
                    onLegendSelectChanged,
                    forwardedRef,
                  }),
                  fixed: <Placeholder height="200px" testId="skeleton-ui" />,
                })}
              </ChartWrapper>
            </TransitionChart>
          );
        }}
      </ChartZoom>
    );
  }
}

export default withTheme(WidgetCardChart);

const StyledTransparentLoadingMask = styled(props => (
  <TransparentLoadingMask {...props} maskBackgroundColor="transparent" />
))`
  display: flex;
  justify-content: center;
  align-items: center;
`;

function LoadingScreen({loading}: {loading: boolean}) {
  if (!loading) {
    return null;
  }
  return (
    <StyledTransparentLoadingMask visible={loading}>
      <LoadingIndicator mini />
    </StyledTransparentLoadingMask>
  );
}

const LoadingPlaceholder = styled(({className}: PlaceholderProps) => (
  <Placeholder height="200px" className={className} />
))`
  background-color: ${p => p.theme.surface300};
`;

const BigNumberResizeWrapper = styled('div')`
  flex-grow: 1;
  overflow: hidden;
  position: relative;
`;

const BigNumber = styled('div')`
  line-height: 1;
  display: inline-flex;
  flex: 1;
  width: 100%;
  min-height: 0;
  font-size: 32px;
  color: ${p => p.theme.headingColor};
  padding: ${space(1)} ${space(3)} ${space(3)} ${space(3)};

  * {
    text-align: left !important;
  }
`;

const ChartWrapper = styled('div')<{autoHeightResize: boolean; noPadding?: boolean}>`
  ${p => p.autoHeightResize && 'height: 100%;'}
  width: 100%;
  padding: ${p => (p.noPadding ? `0` : `0 ${space(2)} ${space(2)}`)};
`;

const TableWrapper = styled('div')`
  margin-top: ${space(1.5)};
  min-height: 0;
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
`;

const StyledSimpleTableChart = styled(SimpleTableChart)`
  overflow: auto;
  height: 100%;
`;

const StyledErrorPanel = styled(ErrorPanel)`
  padding: ${space(2)};
`;

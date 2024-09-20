import type React from 'react';
import {Component} from 'react';
import type {Theme} from '@emotion/react';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {DataZoomComponentOption, LegendComponentOption} from 'echarts';
import type {Location} from 'history';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {BarChart} from 'sentry/components/charts/barChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {LineChart} from 'sentry/components/charts/lineChart';
import SimpleTableChart from 'sentry/components/charts/simpleTableChart';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {getSeriesSelection, isChartHovered} from 'sentry/components/charts/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {PlaceholderProps} from 'sentry/components/placeholder';
import Placeholder from 'sentry/components/placeholder';
import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {
  EChartDataZoomHandler,
  EChartEventHandler,
  ReactEchartsRef,
  Series,
} from 'sentry/types/echarts';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {
  axisLabelFormatter,
  axisLabelFormatterUsingAggregateOutputType,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {getFieldFormatter} from 'sentry/utils/discover/fieldRenderers';
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
import {AutoSizedText} from 'sentry/views/dashboards/widgetCard/autoSizedText';

import {getFormatter} from '../../../components/charts/components/tooltip';
import {getDatasetConfig} from '../datasetConfig/base';
import type {Widget} from '../types';
import {DisplayType} from '../types';

import type {GenericWidgetQueriesChildrenProps} from './genericWidgetQueries';

const OTHER = 'Other';
const PERCENTAGE_DECIMAL_POINTS = 3;
export const SLIDER_HEIGHT = 60;

export type AugmentedEChartDataZoomHandler = (
  params: Parameters<EChartDataZoomHandler>[0] & {
    seriesEnd: string | number;
    seriesStart: string | number;
  },
  instance: Parameters<EChartDataZoomHandler>[1]
) => void;

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
  router: InjectedRouter;
  selection: PageFilters;
  theme: Theme;
  widget: Widget;
  chartGroup?: string;
  chartZoomOptions?: DataZoomComponentOption;
  expandNumbers?: boolean;
  isMobile?: boolean;
  legendOptions?: LegendComponentOption;
  noPadding?: boolean;
  onLegendSelectChanged?: EChartEventHandler<{
    name: string;
    selected: Record<string, boolean>;
    type: 'legendselectchanged';
  }>;
  onZoom?: AugmentedEChartDataZoomHandler;
  shouldResize?: boolean;
  showSlider?: boolean;
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
      const eventView = eventViewFromWidget(widget.title, widget.queries[0], selection);

      return (
        <StyledSimpleTableChart
          key={`table:${result.title}`}
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

    const {location, organization, widget, isMobile, expandNumbers} = this.props;

    return tableResults.map(result => {
      const tableMeta = {...result.meta};
      const fields = Object.keys(tableMeta);

      let field = fields[0];

      if (
        organization.features.includes('dashboards-bignumber-equations') &&
        defined(widget.queries[0].selectedAggregate)
      ) {
        const index = widget.queries[0].selectedAggregate;
        field = widget.queries[0].aggregates[index];
      }

      // Change tableMeta for the field from integer to string since we will be rendering with toLocaleString
      const shouldExpandInteger = !!expandNumbers && tableMeta[field] === 'integer';
      if (shouldExpandInteger) {
        tableMeta[field] = 'string';
      }

      if (!field || !result.data?.length) {
        return <BigNumber key={`big_number:${result.title}`}>{'\u2014'}</BigNumber>;
      }

      const dataRow = result.data[0];
      const fieldRenderer = getFieldFormatter(field, tableMeta, false);

      const unit = tableMeta.units?.[field];
      const rendered = fieldRenderer(
        shouldExpandInteger ? {[field]: dataRow[field].toLocaleString()} : dataRow,
        {location, organization, unit}
      );

      const isModalWidget = !(widget.id || widget.tempId);
      if (isModalWidget || isMobile) {
        return <BigNumber key={`big_number:${result.title}`}>{rendered}</BigNumber>;
      }

      return expandNumbers ? (
        <BigText>{rendered}</BigText>
      ) : (
        <AutoResizeParent key={`big_number:${result.title}`}>
          <AutoSizedText>
            <NumberContainerOverride>
              <Tooltip title={rendered} showOnlyOnOverflow>
                {rendered}
              </Tooltip>
            </NumberContainerOverride>
          </AutoSizedText>
        </AutoResizeParent>
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
    const stacked = widget.queries[0]?.columns.length > 0;

    switch (widget.displayType) {
      case 'bar':
        return <BarChart {...chartProps} stacked={stacked} />;
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
      showSlider,
      noPadding,
      chartZoomOptions,
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

    const {location, router, selection, onLegendSelectChanged} = this.props;
    const {start, end, period, utc} = selection.datetime;

    const legend = {
      left: 0,
      top: 0,
      selected: getSeriesSelection(location),
      formatter: (seriesName: string) => {
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
        ? timeseriesResultsTypes[axisLabel]
        : 'number';
    const isDurationChart = outputType === 'duration';
    const durationUnit = isDurationChart
      ? timeseriesResults && getDurationUnit(timeseriesResults, legendOptions)
      : undefined;
    const bucketSize = getBucketSize(timeseriesResults);

    const valueFormatter = (value: number, seriesName?: string) => {
      const aggregateName = seriesName?.split(':').pop()?.trim();
      if (aggregateName) {
        return timeseriesResultsTypes
          ? tooltipFormatter(value, timeseriesResultsTypes[aggregateName])
          : tooltipFormatter(value, aggregateOutputType(aggregateName));
      }
      return tooltipFormatter(value, 'number');
    };

    const chartOptions = {
      autoHeightResize: shouldResize ?? true,
      grid: {
        left: 0,
        right: 4,
        top: '40px',
        bottom: showSlider ? SLIDER_HEIGHT : 0,
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
      <ChartZoom
        router={router}
        period={period}
        start={start}
        end={end}
        utc={utc}
        showSlider={showSlider}
        chartZoomOptions={chartZoomOptions}
      >
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
            ? timeseriesResults.map((values, i: number) => {
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
            : [];

          const seriesStart = series[0]?.data[0]?.name;
          const seriesEnd = series[0]?.data[series[0].data.length - 1]?.name;

          const forwardedRef = this.props.chartGroup ? this.handleRef : undefined;

          return (
            <TransitionChart loading={loading} reloading={loading}>
              <LoadingScreen loading={loading} />
              <ChartWrapper autoHeightResize={shouldResize ?? true} noPadding={noPadding}>
                {getDynamicText({
                  value: this.chartComponent({
                    ...zoomRenderProps,
                    ...chartOptions,
                    // Override default datazoom behaviour for updating Global Selection Header
                    ...(onZoom
                      ? {
                          onDataZoom: (evt, chartProps) =>
                            // Need to pass seriesStart and seriesEnd to onZoom since slider zooms
                            // callback with percentage instead of datetime values. Passing seriesStart
                            // and seriesEnd allows calculating datetime values with percentage.
                            onZoom({...evt, seriesStart, seriesEnd}, chartProps),
                        }
                      : {}),
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

const getBucketSize = (series: Series[] | undefined) => {
  if (!series || series.length < 2) {
    return 0;
  }

  return Number(series[0].data[1]?.name) - Number(series[0].data[0]?.name);
};

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
  margin: ${space(1)} ${space(3)} ${space(3)} ${space(3)};
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

const AutoResizeParent = styled('div')`
  position: absolute;
  color: ${p => p.theme.headingColor};
  inset: 0;

  * {
    line-height: 1;
    text-align: left !important;
  }
`;

const BigText = styled('div')`
  display: block;
  width: 100%;
  color: ${p => p.theme.headingColor};
  font-size: max(min(8vw, 90px), 30px);
  padding: ${space(1)} ${space(3)} 0 ${space(3)};
  white-space: nowrap;

  * {
    text-align: left !important;
  }
`;

/**
 * This component overrides the default behavior of `NumberContainer`,
 * which wraps every single number in big widgets. This override forces
 * `NumberContainer` to never truncate its values, which makes it possible
 * to auto-size them.
 */
const NumberContainerOverride = styled('div')`
  display: inline-block;

  * {
    text-overflow: clip !important;
    display: inline;
    white-space: nowrap;
  }
`;

const ChartWrapper = styled('div')<{autoHeightResize: boolean; noPadding?: boolean}>`
  ${p => p.autoHeightResize && 'height: 100%;'}
  padding: ${p => (p.noPadding ? `0` : `0 ${space(3)} ${space(3)}`)};
`;

const StyledSimpleTableChart = styled(SimpleTableChart)`
  margin-top: ${space(1.5)};
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeMedium};
  box-shadow: none;
`;

const StyledErrorPanel = styled(ErrorPanel)`
  padding: ${space(2)};
`;

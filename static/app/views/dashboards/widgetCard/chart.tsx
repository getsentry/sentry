import {Component} from 'react';
import {InjectedRouter} from 'react-router';
import {Theme, withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {DataZoomComponentOption, LegendComponentOption} from 'echarts';
import {Location} from 'history';
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
import {getSeriesSelection} from 'sentry/components/charts/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder, {PlaceholderProps} from 'sentry/components/placeholder';
import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import {EChartDataZoomHandler, EChartEventHandler} from 'sentry/types/echarts';
import {
  axisLabelFormatter,
  axisLabelFormatterUsingAggregateOutputType,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {getFieldFormatter} from 'sentry/utils/discover/fieldRenderers';
import {
  aggregateOutputType,
  AggregationOutputType,
  getAggregateArg,
  getEquation,
  getMeasurementSlug,
  isEquation,
  maybeEquationAlias,
  stripDerivedMetricsPrefix,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import getDynamicText from 'sentry/utils/getDynamicText';
import {
  formatMetricAxisValue,
  renderMetricField,
} from 'sentry/views/dashboards/datasetConfig/metrics';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';

import {getDatasetConfig} from '../datasetConfig/base';
import {DisplayType, Widget, WidgetType} from '../types';

import {GenericWidgetQueriesChildrenProps} from './genericWidgetQueries';

const OTHER = 'Other';
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
  showSlider?: boolean;
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  windowWidth?: number;
};

type State = {
  // For tracking height of the container wrapping BigNumber widgets
  // so we can dynamically scale font-size
  containerHeight: number;
};

class WidgetCardChart extends Component<WidgetCardChartProps, State> {
  state = {containerHeight: 0};

  shouldComponentUpdate(nextProps: WidgetCardChartProps, nextState: State): boolean {
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

    return !isEqual(currentProps, nextProps) || !isEqual(this.state, nextState);
  }

  tableResultComponent({
    loading,
    errorMessage,
    tableResults,
  }: TableResultProps): React.ReactNode {
    const {location, widget, organization, selection} = this.props;
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
          organization={organization}
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

    const {containerHeight} = this.state;
    const {location, organization, widget, isMobile, expandNumbers} = this.props;

    return tableResults.map(result => {
      const tableMeta = {...result.meta};
      const fields = Object.keys(tableMeta);

      const field = fields[0];

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
      const rendered =
        widget.widgetType === WidgetType.METRICS
          ? renderMetricField(field, dataRow[field])
          : fieldRenderer(
              shouldExpandInteger ? {[field]: dataRow[field].toLocaleString()} : dataRow,
              {location, organization, unit}
            );

      const isModalWidget = !(widget.id || widget.tempId);
      if (isModalWidget || isMobile) {
        return <BigNumber key={`big_number:${result.title}`}>{rendered}</BigNumber>;
      }

      // The font size is the container height, minus the top and bottom padding
      const fontSize = !expandNumbers
        ? containerHeight - parseInt(space(1), 10) - parseInt(space(3), 10)
        : `max(min(8vw, 90px), ${space(4)})`;

      return (
        <BigNumber
          key={`big_number:${result.title}`}
          style={{
            fontSize,
            ...(expandNumbers ? {padding: `${space(1)} ${space(3)} 0 ${space(3)}`} : {}),
          }}
        >
          <Tooltip title={rendered} showOnlyOnOverflow>
            {rendered}
          </Tooltip>
        </BigNumber>
      );
    });
  }

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
      expandNumbers,
      showSlider,
      noPadding,
      chartZoomOptions,
      timeseriesResultsTypes,
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
          <BigNumberResizeWrapper
            ref={el => {
              if (el !== null && !expandNumbers) {
                const {height} = el.getBoundingClientRect();
                if (height !== this.state.containerHeight) {
                  this.setState({containerHeight: height});
                }
              }
            }}
          >
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

    // Only allow height resizing for widgets that are on a dashboard
    const autoHeightResize = Boolean(widget.id || widget.tempId);

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

    const chartOptions = {
      autoHeightResize,
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
        valueFormatter: (value: number, seriesName: string) => {
          if (widget.widgetType === WidgetType.METRICS) {
            return formatMetricAxisValue(axisField, value);
          }
          const aggregateName = seriesName?.split(':').pop()?.trim();
          if (aggregateName) {
            return timeseriesResultsTypes
              ? tooltipFormatter(value, timeseriesResultsTypes[aggregateName])
              : tooltipFormatter(value, aggregateOutputType(aggregateName));
          }
          return tooltipFormatter(value, 'number');
        },
      },
      yAxis: {
        axisLabel: {
          color: theme.chartLabel,
          formatter: (value: number) => {
            if (widget.widgetType === WidgetType.METRICS) {
              return formatMetricAxisValue(axisField, value);
            }
            if (timeseriesResultsTypes) {
              return axisLabelFormatterUsingAggregateOutputType(
                value,
                outputType,
                undefined,
                durationUnit
              );
            }
            return axisLabelFormatter(value, aggregateOutputType(axisLabel));
          },
        },
        minInterval: durationUnit ?? 0,
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
          const shouldColorOther = timeseriesResults?.some(
            ({seriesName}) => seriesName && seriesName.match(otherRegex)
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
          return (
            <TransitionChart loading={loading} reloading={loading}>
              <LoadingScreen loading={loading} />
              <ChartWrapper autoHeightResize={autoHeightResize} noPadding={noPadding}>
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
  height: 100%;
  width: 100%;
  overflow: hidden;
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

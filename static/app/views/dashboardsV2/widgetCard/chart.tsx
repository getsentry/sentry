import * as React from 'react';
import {InjectedRouter} from 'react-router';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import AreaChart from 'sentry/components/charts/areaChart';
import BarChart from 'sentry/components/charts/barChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import LineChart from 'sentry/components/charts/lineChart';
import SimpleTableChart from 'sentry/components/charts/simpleTableChart';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {getSeriesSelection, processTableResults} from 'sentry/components/charts/utils';
import WorldMapChart from 'sentry/components/charts/worldMapChart';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import Tooltip from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import {EChartDataZoomHandler} from 'sentry/types/echarts';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {getFieldFormatter, getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  getAggregateArg,
  getEquation,
  getMeasurementSlug,
  isEquation,
  maybeEquationAlias,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import getDynamicText from 'sentry/utils/getDynamicText';
import {Theme} from 'sentry/utils/theme';

import {DisplayType, Widget, WidgetType} from '../types';

import WidgetQueries from './widgetQueries';

type TableResultProps = Pick<
  WidgetQueries['state'],
  'errorMessage' | 'loading' | 'tableResults'
>;

type WidgetCardChartProps = Pick<
  WidgetQueries['state'],
  'timeseriesResults' | 'tableResults' | 'errorMessage' | 'loading'
> & {
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
  theme: Theme;
  widget: Widget;
  isMobile?: boolean;
  onZoom?: EChartDataZoomHandler;
  windowWidth?: number;
};

type State = {
  // For tracking height of the container wrapping BigNumber widgets
  // so we can dynamically scale font-size
  containerHeight: number;
};

class WidgetCardChart extends React.Component<WidgetCardChartProps, State> {
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
    const {location, widget, organization} = this.props;
    if (errorMessage) {
      return (
        <ErrorPanel>
          <IconWarning color="gray500" size="lg" />
        </ErrorPanel>
      );
    }

    if (typeof tableResults === 'undefined' || loading) {
      // Align height to other charts.
      return <LoadingPlaceholder height="200px" />;
    }

    return tableResults.map((result, i) => {
      const fields = widget.queries[i]?.fields ?? [];
      return (
        <StyledSimpleTableChart
          key={`table:${result.title}`}
          location={location}
          fields={fields}
          title={tableResults.length > 1 ? result.title : ''}
          loading={loading}
          metadata={result.meta}
          data={result.data}
          organization={organization}
          stickyHeaders
          getCustomFieldRenderer={(field, meta) =>
            getFieldRenderer(field, meta, widget.widgetType !== WidgetType.METRICS)
          }
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
        <ErrorPanel>
          <IconWarning color="gray500" size="lg" />
        </ErrorPanel>
      );
    }

    if (typeof tableResults === 'undefined' || loading) {
      return <BigNumber>{'\u2014'}</BigNumber>;
    }

    const {containerHeight} = this.state;
    const {organization, widget, isMobile} = this.props;

    return tableResults.map(result => {
      const tableMeta = result.meta ?? {};
      const fields = Object.keys(tableMeta ?? {});

      const field = fields[0];

      if (!field || !result.data.length) {
        return <BigNumber key={`big_number:${result.title}`}>{'\u2014'}</BigNumber>;
      }

      const dataRow = result.data[0];
      const fieldRenderer = getFieldFormatter(
        field,
        tableMeta,
        widget.widgetType !== WidgetType.METRICS
      );

      const rendered = fieldRenderer(dataRow);

      const isModalWidget = !!!(widget.id || widget.tempId);
      if (
        !!!organization.features.includes('dashboard-grid-layout') ||
        isModalWidget ||
        isMobile
      ) {
        return <BigNumber key={`big_number:${result.title}`}>{rendered}</BigNumber>;
      }

      // The font size is the container height, minus the top and bottom padding
      const fontSize = containerHeight - parseInt(space(1), 10) - parseInt(space(3), 10);

      return (
        <BigNumber key={`big_number:${result.title}`} style={{fontSize}}>
          <Tooltip title={rendered} showOnlyOnOverflow>
            {rendered}
          </Tooltip>
        </BigNumber>
      );
    });
  }

  chartComponent(chartProps): React.ReactNode {
    const {widget} = this.props;

    switch (widget.displayType) {
      case 'bar':
        return <BarChart {...chartProps} />;
      case 'area':
      case 'top_n':
        return <AreaChart stacked {...chartProps} />;
      case 'world_map':
        return <WorldMapChart {...chartProps} />;
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
      organization,
      onZoom,
    } = this.props;

    if (widget.displayType === 'table') {
      return (
        <TransitionChart loading={loading} reloading={loading}>
          <LoadingScreen loading={loading} />
          {this.tableResultComponent({tableResults, loading, errorMessage})}
        </TransitionChart>
      );
    }

    if (widget.displayType === 'big_number') {
      return (
        <TransitionChart loading={loading} reloading={loading}>
          <LoadingScreen loading={loading} />
          <BigNumberResizeWrapper
            ref={el => {
              if (el !== null) {
                const {height} = el.getBoundingClientRect();
                this.setState({containerHeight: height});
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
        <ErrorPanel>
          <IconWarning color="gray500" size="lg" />
        </ErrorPanel>
      );
    }

    const {location, router, selection} = this.props;
    const {start, end, period, utc} = selection.datetime;

    // Only allow height resizing for widgets that are on a dashboard
    const autoHeightResize = Boolean(
      organization.features.includes('dashboard-grid-layout') &&
        (widget.id || widget.tempId)
    );

    if (widget.displayType === 'world_map') {
      const {data, title} = processTableResults(tableResults);
      const series = [
        {
          seriesName: title,
          data,
        },
      ];

      return (
        <TransitionChart loading={loading} reloading={loading}>
          <LoadingScreen loading={loading} />
          <ChartWrapper autoHeightResize={autoHeightResize}>
            {getDynamicText({
              value: this.chartComponent({
                series,
                autoHeightResize,
              }),
              fixed: <Placeholder height="200px" testId="skeleton-ui" />,
            })}
          </ChartWrapper>
        </TransitionChart>
      );
    }

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
    };

    const axisField = widget.queries[0]?.fields?.[0] ?? 'count()';
    const axisLabel = isEquation(axisField) ? getEquation(axisField) : axisField;
    const chartOptions = {
      autoHeightResize,
      grid: {
        left: 4,
        right: 0,
        top: '40px',
        bottom: 0,
      },
      seriesOptions: {
        showSymbol: false,
      },
      tooltip: {
        trigger: 'axis',
        valueFormatter: tooltipFormatter,
      },
      yAxis: {
        axisLabel: {
          color: theme.chartLabel,
          formatter: (value: number) => axisLabelFormatter(value, axisLabel),
        },
      },
    };

    return (
      <ChartZoom router={router} period={period} start={start} end={end} utc={utc}>
        {zoomRenderProps => {
          if (errorMessage) {
            return (
              <ErrorPanel>
                <IconWarning color="gray500" size="lg" />
              </ErrorPanel>
            );
          }

          const colors = timeseriesResults
            ? theme.charts.getColorPalette(timeseriesResults.length - 2)
            : [];
          // TODO(wmak): Need to change this when updating dashboards to support variable topEvents
          if (
            widget.displayType === 'top_n' &&
            timeseriesResults &&
            timeseriesResults.length > 5
          ) {
            colors[colors.length - 1] = theme.chartOther;
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

          return (
            <TransitionChart loading={loading} reloading={loading}>
              <LoadingScreen loading={loading} />
              <ChartWrapper autoHeightResize={autoHeightResize}>
                {getDynamicText({
                  value: this.chartComponent({
                    ...zoomRenderProps,
                    ...chartOptions,
                    // Override default datazoom behaviour for updating Global Selection Header
                    ...(onZoom ? {onDataZoom: onZoom} : {}),
                    legend,
                    series,
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

const StyledTransparentLoadingMask = styled(props => (
  <TransparentLoadingMask {...props} maskBackgroundColor="transparent" />
))`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const LoadingScreen = ({loading}: {loading: boolean}) => {
  if (!loading) {
    return null;
  }
  return (
    <StyledTransparentLoadingMask visible={loading}>
      <LoadingIndicator mini />
    </StyledTransparentLoadingMask>
  );
};
const LoadingPlaceholder = styled(Placeholder)`
  background-color: ${p => p.theme.surface200};
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

const ChartWrapper = styled('div')<{autoHeightResize: boolean}>`
  ${p => p.autoHeightResize && 'height: 100%;'}
  padding: 0 ${space(3)} ${space(3)};
`;

const StyledSimpleTableChart = styled(SimpleTableChart)`
  margin-top: ${space(1.5)};
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeMedium};
  box-shadow: none;
`;

export default withTheme(WidgetCardChart);

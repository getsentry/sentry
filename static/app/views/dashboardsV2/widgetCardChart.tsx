import * as React from 'react';
import * as ReactRouter from 'react-router';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import AreaChart from 'app/components/charts/areaChart';
import BarChart from 'app/components/charts/barChart';
import ChartZoom from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import LineChart from 'app/components/charts/lineChart';
import SimpleTableChart from 'app/components/charts/simpleTableChart';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {getSeriesSelection} from 'app/components/charts/utils';
import WorldMapChart from 'app/components/charts/worldMapChart';
import LoadingIndicator from 'app/components/loadingIndicator';
import Placeholder from 'app/components/placeholder';
import {IconWarning} from 'app/icons';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import {axisLabelFormatter, tooltipFormatter} from 'app/utils/discover/charts';
import {getFieldFormatter} from 'app/utils/discover/fieldRenderers';
import {getAggregateArg, getMeasurementSlug} from 'app/utils/discover/fields';
import getDynamicText from 'app/utils/getDynamicText';
import {Theme} from 'app/utils/theme';

import {Widget} from './types';
import WidgetQueries from './widgetQueries';

type TableResultProps = Pick<
  WidgetQueries['state'],
  'errorMessage' | 'loading' | 'tableResults'
>;

type WidgetCardChartProps = Pick<ReactRouter.WithRouterProps, 'router'> &
  Pick<
    WidgetQueries['state'],
    'timeseriesResults' | 'tableResults' | 'errorMessage' | 'loading'
  > & {
    theme: Theme;
    organization: Organization;
    location: Location;
    widget: Widget;
    selection: GlobalSelection;
  };

class WidgetCardChart extends React.Component<WidgetCardChartProps> {
  shouldComponentUpdate(nextProps: WidgetCardChartProps): boolean {
    // Widget title changes should not update the WidgetCardChart component tree
    const currentProps = {
      ...this.props,
      widget: {
        ...this.props.widget,
        title: '',
      },
    };

    nextProps = {
      ...nextProps,
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
      return <Placeholder height="200px" />;
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

    return tableResults.map(result => {
      const tableMeta = result.meta ?? {};
      const fields = Object.keys(tableMeta ?? {});

      const field = fields[0];

      if (!field || !result.data.length) {
        return <BigNumber key={`big_number:${result.title}`}>{'\u2014'}</BigNumber>;
      }

      const dataRow = result.data[0];
      const fieldRenderer = getFieldFormatter(field, tableMeta);

      const rendered = fieldRenderer(dataRow);

      return <BigNumber key={`big_number:${result.title}`}>{rendered}</BigNumber>;
    });
  }

  chartComponent(chartProps): React.ReactNode {
    const {widget} = this.props;

    switch (widget.displayType) {
      case 'bar':
        return <BarChart {...chartProps} />;
      case 'area':
        return <AreaChart stacked {...chartProps} />;
      case 'world_map':
        return <WorldMapChart {...chartProps} />;
      case 'line':
      default:
        return <LineChart {...chartProps} />;
    }
  }

  render() {
    const {theme, tableResults, timeseriesResults, errorMessage, loading, widget} =
      this.props;

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
          {this.bigNumberComponent({tableResults, loading, errorMessage})}
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

    if (widget.displayType === 'world_map') {
      const DEFAULT_GEO_DATA = {
        title: '',
        data: [],
      };

      const processTableResults = () => {
        if (!tableResults || !tableResults.length) {
          return DEFAULT_GEO_DATA;
        }

        const tableResult = tableResults[0];

        const {data, meta} = tableResult;

        if (!data || !data.length || !meta) {
          return DEFAULT_GEO_DATA;
        }

        const preAggregate = Object.keys(meta).find(column => {
          return column !== 'geo.country_code';
        });

        if (!preAggregate) {
          return DEFAULT_GEO_DATA;
        }

        return {
          title: tableResult.title ?? '',
          data: data
            .filter(row => row['geo.country_code'])
            .map(row => {
              return {name: row['geo.country_code'], value: row[preAggregate]};
            }),
        };
      };

      const {data, title} = processTableResults();

      const series = [
        {
          seriesName: title,
          data,
        },
      ];

      return (
        <TransitionChart loading={loading} reloading={loading}>
          <LoadingScreen loading={loading} />
          <ChartWrapper>
            {getDynamicText({
              value: this.chartComponent({
                series,
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
        return seriesName;
      },
    };

    const axisField = widget.queries[0]?.fields?.[0] ?? 'count()';
    const chartOptions = {
      grid: {
        left: 0,
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
          formatter: (value: number) => axisLabelFormatter(value, axisField),
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

          // Create a list of series based on the order of the fields,
          const series = timeseriesResults
            ? timeseriesResults.map((values, i: number) => ({
                ...values,
                color: colors[i],
              }))
            : [];

          return (
            <TransitionChart loading={loading} reloading={loading}>
              <LoadingScreen loading={loading} />
              <ChartWrapper>
                {getDynamicText({
                  value: this.chartComponent({
                    ...zoomRenderProps,
                    ...chartOptions,
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

const BigNumber = styled('div')`
  font-size: 32px;
  padding: ${space(1)} ${space(3)} ${space(3)} ${space(3)};
  * {
    text-align: left !important;
  }
`;

const ChartWrapper = styled('div')`
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

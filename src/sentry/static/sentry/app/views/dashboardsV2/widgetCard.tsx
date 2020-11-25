import React from 'react';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import BarChart from 'app/components/charts/barChart';
import ChartZoom from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import EventsRequest from 'app/components/charts/eventsRequest';
import LineChart from 'app/components/charts/lineChart';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {getInterval, getSeriesSelection} from 'app/components/charts/utils';
import ErrorBoundary from 'app/components/errorBoundary';
import {Panel, PanelBody} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import {Series} from 'app/types/echarts';
import {axisLabelFormatter, tooltipFormatter} from 'app/utils/discover/charts';
import {getAggregateArg, getMeasurementSlug} from 'app/utils/discover/fields';
import getDynamicText from 'app/utils/getDynamicText';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import {Widget, WidgetQuery} from './types';

type Props = ReactRouter.WithRouterProps & {
  api: Client;
  organization: Organization;
  widget: Widget;
  selection: GlobalSelection;
};

class WidgetCard extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    if (
      !isEqual(nextProps.widget.queries, this.props.widget.queries) ||
      !isEqual(nextProps.selection, this.props.selection) ||
      nextProps.widget.title !== this.props.widget.title
    ) {
      return true;
    }
    return false;
  }

  renderWidgetQuery(widgetQuery: WidgetQuery, index: number) {
    const {location, router, selection, api, organization, widget} = this.props;

    const statsPeriod = selection.datetime.period;
    const {start, end} = selection.datetime;
    const {projects, environments} = selection;

    const datetimeSelection = {
      start: start || null,
      end: end || null,
      period: statsPeriod,
    };

    const legend = {
      right: 10,
      top: 0,
      icon: 'circle',
      itemHeight: 8,
      itemWidth: 8,
      itemGap: 12,
      align: 'left',
      textStyle: {
        verticalAlign: 'top',
        fontSize: 11,
        fontFamily: 'Rubik',
      },
      selected: getSeriesSelection(location),
      formatter: seriesName => {
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

    const chartOptions = {
      grid: {
        left: '10px',
        right: '10px',
        top: '40px',
        bottom: '0px',
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
          formatter: (value: number) =>
            axisLabelFormatter(value, widgetQuery.fields[0] ?? ''),
        },
      },
    };

    const yAxis = [...widgetQuery.fields];

    return (
      <ChartZoom
        key={String(index)}
        router={router}
        period={statsPeriod}
        projects={projects}
        environments={environments}
      >
        {zoomRenderProps => {
          return (
            <EventsRequest
              api={api}
              organization={organization}
              period={statsPeriod}
              project={[...projects]}
              environment={[...environments]}
              start={start}
              end={end}
              interval={getInterval(datetimeSelection, true)}
              showLoading={false}
              query={widgetQuery.conditions}
              includePrevious={false}
              yAxis={yAxis}
            >
              {({results, errored, loading, reloading, timeseriesData}) => {
                if (errored) {
                  return (
                    <ErrorPanel>
                      <IconWarning color="gray500" size="lg" />
                    </ErrorPanel>
                  );
                }

                if (
                  yAxis.length === 1 &&
                  timeseriesData &&
                  timeseriesData.length &&
                  widgetQuery.fields.length
                ) {
                  timeseriesData[0] = {
                    ...timeseriesData[0],
                    seriesName: widgetQuery.fields[0],
                  };
                }

                // normalize chart data depending on number of y-axis data
                const chartData = (yAxis.length === 1
                  ? timeseriesData
                  : results) as Series[];

                const colors = chartData
                  ? theme.charts.getColorPalette(chartData.length - 2)
                  : [];

                // Create a list of series based on the order of the fields,
                const series = chartData
                  ? chartData.map((values, i: number) => ({
                      ...values,
                      color: colors[i],
                    }))
                  : [];

                // Stack the toolbox under the legend.
                // so all series names are clickable.
                zoomRenderProps.toolBox.z = -1;

                let chart: React.ReactNode = null;

                switch (widget.displayType) {
                  case 'bar': {
                    chart = (
                      <BarChart
                        {...zoomRenderProps}
                        {...chartOptions}
                        legend={legend}
                        series={[...series]}
                      />
                    );
                    break;
                  }
                  case 'line':
                  default: {
                    chart = (
                      <LineChart
                        {...zoomRenderProps}
                        {...chartOptions}
                        legend={legend}
                        series={[...series]}
                      />
                    );
                  }
                }

                return (
                  <TransitionChart loading={loading} reloading={reloading}>
                    <TransparentLoadingMask visible={reloading} />
                    {getDynamicText({
                      value: chart,
                      fixed: 'Line Chart',
                    })}
                  </TransitionChart>
                );
              }}
            </EventsRequest>
          );
        }}
      </ChartZoom>
    );
  }

  render() {
    const {widget} = this.props;
    return (
      <ErrorBoundary
        customComponent={<ErrorCard>{t('Error loading widget data')}</ErrorCard>}
      >
        <StyledPanel>
          <WidgetHeader>{widget.title}</WidgetHeader>
          <StyledPanelBody>
            {widget.queries.map((widgetQuery, index) =>
              this.renderWidgetQuery(widgetQuery, index)
            )}
          </StyledPanelBody>
        </StyledPanel>
      </ErrorBoundary>
    );
  }
}

export default withApi(
  withOrganization(withGlobalSelection(ReactRouter.withRouter(WidgetCard)))
);

const ErrorCard = styled(Placeholder)`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${p => p.theme.alert.error.backgroundLight};
  border: 1px solid ${p => p.theme.alert.error.border};
  color: ${p => p.theme.alert.error.textLight};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(2)};
`;

const WidgetHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
`;

const StyledPanelBody = styled(PanelBody)`
  height: 250px;
`;

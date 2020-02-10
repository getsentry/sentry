import isEqual from 'lodash/isEqual';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {getInterval} from 'app/components/charts/utils';
import ChartZoom from 'app/components/charts/chartZoom';
import AreaChart from 'app/components/charts/areaChart';
import LoadingMask from 'app/components/loadingMask';
import LoadingPanel from 'app/views/events/loadingPanel';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {IconWarning} from 'app/icons';
import theme from 'app/utils/theme';

import EventsRequest from './utils/eventsRequest';

class EventsAreaChart extends React.Component {
  static propTypes = {
    loading: PropTypes.bool,
    reloading: PropTypes.bool,
    releaseSeries: PropTypes.array,
    zoomRenderProps: PropTypes.object,
    timeseriesData: PropTypes.array,
    showLegend: PropTypes.bool,
    previousTimeseriesData: PropTypes.object,
  };

  shouldComponentUpdate(nextProps) {
    if (nextProps.reloading || !nextProps.timeseriesData) {
      return false;
    }

    if (
      isEqual(this.props.timeseriesData, nextProps.timeseriesData) &&
      isEqual(this.props.releaseSeries, nextProps.releaseSeries) &&
      isEqual(this.props.previousTimeseriesData, nextProps.previousTimeseriesData)
    ) {
      return false;
    }

    return true;
  }

  render() {
    const {
      loading, // eslint-disable-line no-unused-vars
      reloading, // eslint-disable-line no-unused-vars
      releaseSeries,
      zoomRenderProps,
      timeseriesData,
      previousTimeseriesData,
      showLegend,
      ...props
    } = this.props;

    const legend = showLegend && {
      right: 16,
      top: 16,
      selectedMode: false,
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
      data: ['Current', 'Previous'],
    };

    return (
      <AreaChart
        {...props}
        {...zoomRenderProps}
        legend={legend}
        series={[...timeseriesData, ...releaseSeries]}
        seriesOptions={{
          showSymbol: false,
        }}
        previousPeriod={previousTimeseriesData ? [previousTimeseriesData] : null}
        grid={{
          left: '24px',
          right: '24px',
          top: '24px',
          bottom: '12px',
        }}
      />
    );
  }
}

class EventsChart extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    projects: PropTypes.arrayOf(PropTypes.number),
    environments: PropTypes.arrayOf(PropTypes.string),
    period: PropTypes.string,
    query: PropTypes.string,
    start: PropTypes.instanceOf(Date),
    end: PropTypes.instanceOf(Date),
    utc: PropTypes.bool,
    router: PropTypes.object,
    showLegend: PropTypes.bool,
    yAxis: PropTypes.string,
    onTooltipUpdate: PropTypes.func,
  };

  render() {
    const {
      api,
      period,
      utc,
      query,
      router,
      start,
      end,
      projects,
      environments,
      showLegend,
      yAxis,
      onTooltipUpdate,
      ...props
    } = this.props;
    // Include previous only on relative dates (defaults to relative if no start and end)
    const includePrevious = !start && !end;

    let tooltip = null;
    if (onTooltipUpdate) {
      tooltip = {
        formatter(seriesData) {
          // Releases are the only markline we use right now.
          if (seriesData.componentType === 'markLine') {
            onTooltipUpdate({
              values: [{name: t('Release'), value: seriesData.data.name}],
              timestamp: seriesData.data.coord[0],
            });

            return null;
          }
          const series = Array.isArray(seriesData) ? seriesData : [seriesData];
          onTooltipUpdate({
            values: series.map(item => ({name: item.seriesName, value: item.data[1]})),
            timestamp: series[0].data[0],
          });
          return null;
        },
      };
    }

    return (
      <ChartZoom
        router={router}
        period={period}
        utc={utc}
        projects={projects}
        environments={environments}
        {...props}
      >
        {zoomRenderProps => (
          <EventsRequest
            {...props}
            api={api}
            period={period}
            project={projects}
            environment={environments}
            start={start}
            end={end}
            interval={getInterval(this.props, true)}
            showLoading={false}
            query={query}
            includePrevious={includePrevious}
            yAxis={yAxis}
          >
            {({loading, reloading, errored, timeseriesData, previousTimeseriesData}) => {
              return (
                <ReleaseSeries tooltip={tooltip} utc={utc} api={api} projects={projects}>
                  {({releaseSeries}) => {
                    if (errored) {
                      return (
                        <ErrorPanel>
                          <IconWarning color={theme.gray2} size="lg" />
                        </ErrorPanel>
                      );
                    }
                    if (loading && !reloading) {
                      return <LoadingPanel data-test-id="events-request-loading" />;
                    }

                    return (
                      <React.Fragment>
                        <TransparentLoadingMask visible={reloading} />
                        <EventsAreaChart
                          {...zoomRenderProps}
                          loading={loading}
                          reloading={reloading}
                          utc={utc}
                          showLegend={showLegend}
                          releaseSeries={releaseSeries}
                          timeseriesData={timeseriesData}
                          previousTimeseriesData={previousTimeseriesData}
                          tooltip={tooltip}
                        />
                      </React.Fragment>
                    );
                  }}
                </ReleaseSeries>
              );
            }}
          </EventsRequest>
        )}
      </ChartZoom>
    );
  }
}

const EventsChartContainer = withGlobalSelection(
  withApi(
    class EventsChartWithParams extends React.Component {
      static propTypes = {
        selection: SentryTypes.GlobalSelection,
      };

      render() {
        const {selection, ...props} = this.props;
        const {datetime, projects, environments} = selection;

        return (
          <EventsChart
            {...datetime}
            projects={projects || []}
            environments={environments || []}
            {...props}
          />
        );
      }
    }
  )
);

export default EventsChartContainer;
export {EventsChart, EventsAreaChart};

const TransparentLoadingMask = styled(LoadingMask)`
  ${p => !p.visible && 'display: none;'};
  opacity: 0.4;
  z-index: 1;
`;

const ErrorPanel = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;

  flex: 1;
  flex-shrink: 0;
  overflow: hidden;
  height: 200px;
  position: relative;
  border-color: transparent;
  margin-bottom: 0;
`;

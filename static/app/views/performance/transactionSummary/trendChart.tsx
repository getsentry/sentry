import {Component, Fragment} from 'react';
import * as ReactRouter from 'react-router';
import {browserHistory} from 'react-router';
import {withTheme} from '@emotion/react';
import {Location, Query} from 'history';

import {Client} from 'app/api';
import ChartZoom from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import EventsRequest from 'app/components/charts/eventsRequest';
import LineChart from 'app/components/charts/lineChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import {HeaderTitleLegend} from 'app/components/charts/styles';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {getInterval, getSeriesSelection} from 'app/components/charts/utils';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import Placeholder from 'app/components/placeholder';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {axisLabelFormatter, tooltipFormatter} from 'app/utils/discover/charts';
import EventView from 'app/utils/discover/eventView';
import getDynamicText from 'app/utils/getDynamicText';
import {Theme} from 'app/utils/theme';
import withApi from 'app/utils/withApi';

import {transformEventStatsSmoothed} from '../trends/utils';

const QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;

type ViewProps = Pick<EventView, typeof QUERY_KEYS[number]>;

type Props = ReactRouter.WithRouterProps &
  ViewProps & {
    theme: Theme;
    api: Client;
    location: Location;
    organization: OrganizationSummary;
    queryExtra: Query;
    trendDisplay: string;
  };

class TrendChart extends Component<Props> {
  handleLegendSelectChanged = legendChange => {
    const {location} = this.props;
    const {selected} = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);

    const to = {
      ...location,
      query: {
        ...location.query,
        trendsUnselectedSeries: unselected,
      },
    };
    browserHistory.push(to);
  };

  render() {
    const {
      theme,
      api,
      project,
      environment,
      location,
      organization,
      query,
      statsPeriod,
      router,
      trendDisplay,
      queryExtra,
    } = this.props;

    const start = this.props.start ? getUtcToLocalDateObject(this.props.start) : null;
    const end = this.props.end ? getUtcToLocalDateObject(this.props.end) : null;
    const {utc} = getParams(location.query);

    const legend = {
      right: 10,
      top: 0,
      selected: getSeriesSelection(location, 'trendsUnselectedSeries'),
    };

    const datetimeSelection = {
      start,
      end,
      period: statsPeriod,
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
        trigger: 'axis' as const,
        valueFormatter: value => tooltipFormatter(value, 'p50()'),
      },
      yAxis: {
        min: 0,
        axisLabel: {
          color: theme.chartLabel,
          // p50() coerces the axis to be time based
          formatter: (value: number) => axisLabelFormatter(value, 'p50()'),
        },
      },
    };

    return (
      <Fragment>
        <HeaderTitleLegend>
          {t('Trend')}
          <QuestionTooltip
            size="sm"
            position="top"
            title={t(`Trends shows the smoothed value of an aggregate over time.`)}
          />
        </HeaderTitleLegend>
        <ChartZoom
          router={router}
          period={statsPeriod}
          start={start}
          end={end}
          utc={utc === 'true'}
        >
          {zoomRenderProps => (
            <EventsRequest
              api={api}
              organization={organization}
              period={statsPeriod}
              project={project}
              environment={environment}
              start={start}
              end={end}
              interval={getInterval(datetimeSelection, 'high')}
              showLoading={false}
              query={query}
              includePrevious={false}
              yAxis={trendDisplay}
              currentSeriesName={trendDisplay}
              partial
            >
              {({errored, loading, reloading, timeseriesData}) => {
                if (errored) {
                  return (
                    <ErrorPanel>
                      <IconWarning color="gray300" size="lg" />
                    </ErrorPanel>
                  );
                }

                const series = timeseriesData
                  ? timeseriesData
                      .map(values => {
                        return {
                          ...values,
                          color: theme.purple300,
                          lineStyle: {
                            opacity: 0.75,
                            width: 1,
                          },
                        };
                      })
                      .reverse()
                  : [];

                const {smoothedResults} = transformEventStatsSmoothed(
                  timeseriesData,
                  t('Smoothed')
                );

                const smoothedSeries = smoothedResults
                  ? smoothedResults.map(values => {
                      return {
                        ...values,
                        color: theme.purple300,
                        lineStyle: {
                          opacity: 1,
                        },
                      };
                    })
                  : [];

                return (
                  <ReleaseSeries
                    start={start}
                    end={end}
                    queryExtra={queryExtra}
                    period={statsPeriod}
                    utc={utc === 'true'}
                    projects={project}
                    environments={environment}
                  >
                    {({releaseSeries}) => (
                      <TransitionChart loading={loading} reloading={reloading}>
                        <TransparentLoadingMask visible={reloading} />
                        {getDynamicText({
                          value: (
                            <LineChart
                              {...zoomRenderProps}
                              {...chartOptions}
                              legend={legend}
                              onLegendSelectChanged={this.handleLegendSelectChanged}
                              series={[...series, ...smoothedSeries, ...releaseSeries]}
                            />
                          ),
                          fixed: <Placeholder height="200px" testId="skeleton-ui" />,
                        })}
                      </TransitionChart>
                    )}
                  </ReleaseSeries>
                );
              }}
            </EventsRequest>
          )}
        </ChartZoom>
      </Fragment>
    );
  }
}

export default withApi(withTheme(ReactRouter.withRouter(TrendChart)));

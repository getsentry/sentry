import React from 'react';
import * as ReactRouter from 'react-router';

import {OrganizationSummary} from 'app/types';
import {Client} from 'app/api';
import {t} from 'app/locale';
import AreaChart from 'app/components/charts/areaChart';
import ChartZoom from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import TransitionChart from 'app/components/charts/transitionChart';
import EventsRequest from 'app/components/charts/eventsRequest';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import QuestionTooltip from 'app/components/questionTooltip';
import {getInterval} from 'app/components/charts/utils';
import {IconWarning} from 'app/icons';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';
import {decodeScalar} from 'app/utils/queryString';
import theme from 'app/utils/theme';
import {getDuration} from 'app/utils/formatters';
import getDynamicText from 'app/utils/getDynamicText';

import {HeaderTitleLegend} from '../styles';

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
    api: Client;
    organization: OrganizationSummary;
  };

const YAXIS_VALUES = ['p50()', 'p75()', 'p95()', 'p99()', 'p100()'];

/**
 * Fetch and render a stacked area chart that shows duration
 * percentiles over the past 7 days
 */
class DurationChart extends React.Component<Props> {
  render() {
    const {
      api,
      project,
      environment,
      organization,
      query,
      statsPeriod,
      router,
    } = this.props;

    const start = this.props.start
      ? getUtcToLocalDateObject(this.props.start)
      : undefined;

    const end = this.props.end ? getUtcToLocalDateObject(this.props.end) : undefined;
    const utc = decodeScalar(router.location.query.utc);

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
    };

    const tooltip = {
      valueFormatter(value: number) {
        return getDuration(value / 1000, 2);
      },
    };

    const datetimeSelection = {
      start: start || null,
      end: end || null,
      period: statsPeriod,
    };

    return (
      <React.Fragment>
        <HeaderTitleLegend>
          {t('Duration Breakdown')}
          <QuestionTooltip
            size="sm"
            position="top"
            title={t(
              `Duration Breakdown reflects transaction durations by percentile over time.`
            )}
          />
        </HeaderTitleLegend>
        <ChartZoom
          router={router}
          period={statsPeriod}
          projects={project}
          environments={environment}
        >
          {zoomRenderProps => (
            <EventsRequest
              api={api}
              organization={organization}
              period={statsPeriod}
              project={[...project]}
              environment={[...environment]}
              start={start}
              end={end}
              interval={getInterval(datetimeSelection, true)}
              showLoading={false}
              query={query}
              includePrevious={false}
              yAxis={YAXIS_VALUES}
            >
              {({results, errored, loading, reloading}) => {
                if (errored) {
                  return (
                    <ErrorPanel>
                      <IconWarning color="gray500" size="lg" />
                    </ErrorPanel>
                  );
                }
                const colors =
                  (results && theme.charts.getColorPalette(results.length - 2)) || [];

                // Create a list of series based on the order of the fields,
                // We need to flip it at the end to ensure the series stack right.
                const series = results
                  ? results
                      .map((values, i: number) => {
                        return {
                          ...values,
                          color: colors[i],
                          lineStyle: {
                            opacity: 0,
                          },
                        };
                      })
                      .reverse()
                  : [];

                return (
                  <ReleaseSeries
                    start={start}
                    end={end}
                    period={statsPeriod}
                    utc={utc}
                    api={api}
                    projects={project}
                  >
                    {({releaseSeries}) => (
                      <TransitionChart loading={loading} reloading={reloading}>
                        <TransparentLoadingMask visible={reloading} />
                        {getDynamicText({
                          value: (
                            <AreaChart
                              {...zoomRenderProps}
                              legend={legend}
                              series={[...series, ...releaseSeries]}
                              seriesOptions={{
                                showSymbol: false,
                              }}
                              tooltip={tooltip}
                              toolBox={{
                                show: false,
                              }}
                              grid={{
                                left: '10px',
                                right: '10px',
                                top: '40px',
                                bottom: '0px',
                              }}
                            />
                          ),
                          fixed: 'Duration Chart',
                        })}
                      </TransitionChart>
                    )}
                  </ReleaseSeries>
                );
              }}
            </EventsRequest>
          )}
        </ChartZoom>
      </React.Fragment>
    );
  }
}

export default withApi(ReactRouter.withRouter(DurationChart));

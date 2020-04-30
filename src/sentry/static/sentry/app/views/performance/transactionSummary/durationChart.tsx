import React from 'react';
import * as ReactRouter from 'react-router';

import {OrganizationSummary} from 'app/types';
import {Client} from 'app/api';
import {t} from 'app/locale';
import Tooltip from 'app/components/tooltip';
import AreaChart from 'app/components/charts/areaChart';
import ChartZoom from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/components/errorPanel';
import TransparentLoadingMask from 'app/components/charts/components/transparentLoadingMask';
import TransitionChart from 'app/components/charts/transitionChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import {AREA_COLORS, getInterval} from 'app/components/charts/utils';
import {IconWarning} from 'app/icons';
import EventsRequest from 'app/views/events/utils/eventsRequest';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';
import {decodeScalar} from 'app/utils/queryString';
import theme from 'app/utils/theme';
import {getDuration} from 'app/utils/formatters';

import {HeaderTitle, StyledIconQuestion} from '../styles';

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
      right: 16,
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
        <HeaderTitle>
          {t('Duration Breakdown')}
          <Tooltip
            position="top"
            title={t(
              `This graph shows a breakdown of transaction durations by percentile over time.`
            )}
          >
            <StyledIconQuestion size="sm" />
          </Tooltip>
        </HeaderTitle>
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
                      <IconWarning color={theme.gray2} size="lg" />
                    </ErrorPanel>
                  );
                }
                // Create a list of series based on the order of the fields,
                // We need to flip it at the end to ensure the series stack right.
                const series = results
                  ? results
                      .map((values, i: number) => {
                        return {
                          ...values,
                          color: AREA_COLORS[i],
                          lineStyle: {
                            opacity: 0,
                          },
                          areaStyle: {
                            color: AREA_COLORS[i],
                            opacity: 1.0,
                          },
                        };
                      })
                      .reverse()
                  : [];

                return (
                  <ReleaseSeries utc={utc} api={api} projects={project}>
                    {({releaseSeries}) => (
                      <TransitionChart loading={loading} reloading={reloading}>
                        <TransparentLoadingMask visible={reloading} />
                        <AreaChart
                          {...zoomRenderProps}
                          legend={legend}
                          series={[...series, ...releaseSeries]}
                          seriesOptions={{
                            showSymbol: false,
                          }}
                          tooltip={tooltip}
                          grid={{
                            left: '24px',
                            right: '24px',
                            top: '32px',
                            bottom: '12px',
                          }}
                        />
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

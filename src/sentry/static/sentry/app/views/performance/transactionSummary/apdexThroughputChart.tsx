import React from 'react';
import styled from '@emotion/styled';
import * as ReactRouter from 'react-router';

import {OrganizationSummary} from 'app/types';
import {Client} from 'app/api';
import {t} from 'app/locale';
import AreaChart from 'app/components/charts/areaChart';
import ChartZoom from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import TransitionChart from 'app/components/charts/transitionChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import QuestionTooltip from 'app/components/questionTooltip';
import {getInterval} from 'app/components/charts/utils';
import {IconWarning} from 'app/icons';
import EventsRequest from 'app/views/events/utils/eventsRequest';
import {PERFORMANCE_TERMS} from 'app/views/performance/constants';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';
import {decodeScalar} from 'app/utils/queryString';
import theme from 'app/utils/theme';

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

const YAXIS_VALUES = ['apdex(300)', 'rpm()'];

/**
 * Display a transaction's throughput and apdex over time.
 */
class ApdexThroughputChart extends React.Component<Props> {
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

    const colors = theme.charts.getColorPalette(2);
    const chartOptions = {
      height: 460,
      grid: [
        {
          top: '40px',
          left: '10px',
          right: '10px',
          height: '200px',
        },
        {
          top: '260px',
          left: '10px',
          right: '10px',
          height: '200px',
        },
      ],
      axisPointer: {
        // Link the two series x-axis together.
        link: [{xAxisIndex: [0, 1]}],
      },
      xAxes: [
        {
          gridIndex: 0,
          type: 'time',
        },
        {
          gridIndex: 1,
          type: 'time',
        },
      ],
      yAxes: [{gridIndex: 0}, {gridIndex: 1}],
      utc,
      isGroupedByDate: true,
      showTimeInTooltip: true,
      colors: [colors[0], colors[1]],
    };

    const datetimeSelection = {
      start: start || null,
      end: end || null,
      period: statsPeriod,
    };

    return (
      <React.Fragment>
        <HeaderTitleLegend key="apdex">
          {t('Apdex')}
          <QuestionTooltip position="top" size="sm" title={PERFORMANCE_TERMS.apdex} />
        </HeaderTitleLegend>
        <MiddleHeaderTitleLegend key="rpm">
          {t('Throughput')}
          <QuestionTooltip position="top" size="sm" title={PERFORMANCE_TERMS.rpm} />
        </MiddleHeaderTitleLegend>
        <ChartZoom
          router={router}
          period={statsPeriod}
          projects={project}
          environments={environment}
          xAxisIndex={[0, 1]}
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
                const series = results
                  ? results.map((values, i: number) => ({
                      ...values,
                      yAxisIndex: i,
                      xAxisIndex: i,
                    }))
                  : [];

                return (
                  <ReleaseSeries utc={utc} api={api} projects={project}>
                    {({releaseSeries}) => (
                      <TransitionChart
                        loading={loading}
                        reloading={reloading}
                        height="460px"
                      >
                        <TransparentLoadingMask visible={reloading} />
                        <AreaChart
                          {...zoomRenderProps}
                          {...chartOptions}
                          series={[...series, ...releaseSeries]}
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

const MiddleHeaderTitleLegend = styled(HeaderTitleLegend)`
  position: absolute;
  top: 260px;
`;

export default withApi(ReactRouter.withRouter(ApdexThroughputChart));

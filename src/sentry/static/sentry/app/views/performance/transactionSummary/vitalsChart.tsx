import React from 'react';
import {browserHistory} from 'react-router';
import * as ReactRouter from 'react-router';
import {Location} from 'history';

import {Client} from 'app/api';
import ChartZoom from 'app/components/charts/chartZoom';
import Legend from 'app/components/charts/components/legend';
import ErrorPanel from 'app/components/charts/errorPanel';
import EventsRequest from 'app/components/charts/eventsRequest';
import LineChart from 'app/components/charts/lineChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {getInterval, getSeriesSelection} from 'app/components/charts/utils';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {axisLabelFormatter, tooltipFormatter} from 'app/utils/discover/charts';
import EventView from 'app/utils/discover/eventView';
import {getAggregateArg, getMeasurementSlug} from 'app/utils/discover/fields';
import getDynamicText from 'app/utils/getDynamicText';
import {decodeScalar} from 'app/utils/queryString';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import {TransactionsListOption} from 'app/views/releases/detail/overview';

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
    location: Location;
    organization: OrganizationSummary;
    queryExtra: object;
  };

const YAXIS_VALUES = [
  'p75(measurements.fp)',
  'p75(measurements.fcp)',
  'p75(measurements.lcp)',
  'p75(measurements.fid)',
];

class VitalsChart extends React.Component<Props> {
  handleLegendSelectChanged = legendChange => {
    const {location} = this.props;
    const {selected} = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);

    const to = {
      ...location,
      query: {
        ...location.query,
        unselectedSeries: unselected,
      },
    };
    browserHistory.push(to);
  };

  render() {
    const {
      api,
      project,
      environment,
      location,
      organization,
      query,
      statsPeriod,
      router,
      queryExtra,
    } = this.props;

    const start = this.props.start ? getUtcToLocalDateObject(this.props.start) : null;
    const end = this.props.end ? getUtcToLocalDateObject(this.props.end) : null;
    const utc = decodeScalar(router.location.query.utc) !== 'false';

    const legend = Legend({
      right: 10,
      top: 0,
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
      theme,
    });

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
        valueFormatter: tooltipFormatter,
      },
      yAxis: {
        axisLabel: {
          color: theme.chartLabel,
          // p75(measurements.fcp) coerces the axis to be time based
          formatter: (value: number) =>
            axisLabelFormatter(value, 'p75(measurements.fcp)'),
        },
      },
    };

    return (
      <React.Fragment>
        <HeaderTitleLegend>
          {t('Web Vitals Breakdown')}
          <QuestionTooltip
            size="sm"
            position="top"
            title={t(
              `Web Vitals Breakdown reflects the 75th percentile of web vitals over time.`
            )}
          />
        </HeaderTitleLegend>
        <ChartZoom router={router} period={statsPeriod}>
          {zoomRenderProps => (
            <EventsRequest
              api={api}
              organization={organization}
              period={statsPeriod}
              project={project}
              environment={environment}
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
                const series = results
                  ? results.map((values, i: number) => ({
                      ...values,
                      color: colors[i],
                    }))
                  : [];

                return (
                  <ReleaseSeries
                    start={start}
                    end={end}
                    queryExtra={{
                      ...queryExtra,
                      showTransactions: TransactionsListOption.SLOW_LCP,
                    }}
                    period={statsPeriod}
                    utc={utc}
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
                              series={[...series, ...releaseSeries]}
                            />
                          ),
                          fixed: 'Web Vitals Chart',
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

export default withApi(ReactRouter.withRouter(VitalsChart));

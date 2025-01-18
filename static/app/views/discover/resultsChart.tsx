import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import isEqual from 'lodash/isEqual';

import type {Client} from 'sentry/api';
import {AreaChart} from 'sentry/components/charts/areaChart';
import {BarChart} from 'sentry/components/charts/barChart';
import EventsChart from 'sentry/components/charts/eventsChart';
import {getInterval, getPreviousSeriesName} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {CustomMeasurementsContext} from 'sentry/utils/customMeasurements/customMeasurementsContext';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import type EventView from 'sentry/utils/discover/eventView';
import {getAggregateArg, stripEquationPrefix} from 'sentry/utils/discover/fields';
import {
  DisplayModes,
  MULTI_Y_AXIS_SUPPORTED_DISPLAY_MODES,
  TOP_EVENT_MODES,
  TOP_N,
} from 'sentry/utils/discover/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import {valueIsEqual} from 'sentry/utils/object/valueIsEqual';
import {decodeScalar} from 'sentry/utils/queryString';
import withApi from 'sentry/utils/withApi';

import {isCustomMeasurement} from '../dashboards/utils';

import ChartFooter from './chartFooter';

type ResultsChartProps = {
  api: Client;
  confirmedQuery: boolean;
  eventView: EventView;
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  yAxisValue: string[];
  customMeasurements?: CustomMeasurementCollection | undefined;
};

class ResultsChart extends Component<ResultsChartProps> {
  shouldComponentUpdate(nextProps: ResultsChartProps) {
    const {eventView, ...restProps} = this.props;
    const {eventView: nextEventView, ...restNextProps} = nextProps;

    if (!eventView.isEqualTo(nextEventView)) {
      return true;
    }

    return !isEqual(restProps, restNextProps);
  }

  render() {
    const {
      api,
      eventView,
      location,
      organization,
      router,
      confirmedQuery,
      yAxisValue,
      customMeasurements,
    } = this.props;

    const hasPerformanceChartInterpolation = organization.features.includes(
      'performance-chart-interpolation'
    );

    const globalSelection = eventView.getPageFilters();
    const start = globalSelection.datetime.start
      ? getUtcToLocalDateObject(globalSelection.datetime.start)
      : null;

    const end = globalSelection.datetime.end
      ? getUtcToLocalDateObject(globalSelection.datetime.end)
      : null;

    const {utc} = normalizeDateTimeParams(location.query);
    const apiPayload = eventView.getEventsAPIPayload(location);
    const display = eventView.getDisplayMode();
    const isTopEvents =
      display === DisplayModes.TOP5 || display === DisplayModes.DAILYTOP5;
    const isPeriod = display === DisplayModes.DEFAULT || display === DisplayModes.TOP5;
    const isDaily = display === DisplayModes.DAILYTOP5 || display === DisplayModes.DAILY;
    const isPrevious = display === DisplayModes.PREVIOUS;
    const referrer = `api.discover.${display}-chart`;
    const topEvents = eventView.topEvents ? parseInt(eventView.topEvents, 10) : TOP_N;
    const aggregateParam = getAggregateArg(yAxisValue[0]!) || '';
    const customPerformanceMetricFieldType = isCustomMeasurement(aggregateParam)
      ? customMeasurements
        ? customMeasurements[aggregateParam]?.fieldType
        : null
      : null;
    const chartComponent =
      display === DisplayModes.BAR
        ? BarChart
        : customPerformanceMetricFieldType === 'size' && isTopEvents
          ? AreaChart
          : undefined;
    const interval =
      display === DisplayModes.BAR
        ? getInterval(
            {
              start,
              end,
              period: globalSelection.datetime.period,
              utc: utc === 'true',
            },
            'low'
          )
        : eventView.interval;

    const seriesLabels = yAxisValue.map(stripEquationPrefix);
    const disableableSeries = [
      ...seriesLabels,
      ...seriesLabels.map(getPreviousSeriesName),
    ];

    return (
      <Fragment>
        {getDynamicText({
          value: (
            <EventsChart
              api={api}
              router={router}
              query={apiPayload.query}
              dataset={apiPayload.dataset}
              organization={organization}
              showLegend
              yAxis={yAxisValue}
              projects={globalSelection.projects}
              environments={globalSelection.environments}
              start={start}
              end={end}
              period={globalSelection.datetime.period}
              disablePrevious={!isPrevious}
              disableReleases={!isPeriod}
              field={isTopEvents ? apiPayload.field : undefined}
              interval={interval}
              showDaily={isDaily}
              topEvents={isTopEvents ? topEvents : undefined}
              orderby={isTopEvents ? decodeScalar(apiPayload.sort) : undefined}
              utc={utc === 'true'}
              confirmedQuery={confirmedQuery}
              withoutZerofill={hasPerformanceChartInterpolation}
              chartComponent={chartComponent}
              referrer={referrer}
              fromDiscover
              disableableSeries={disableableSeries}
            />
          ),
          fixed: <Placeholder height="200px" testId="skeleton-ui" />,
        })}
      </Fragment>
    );
  }
}

type ContainerProps = {
  api: Client;
  confirmedQuery: boolean;
  eventView: EventView;
  location: Location;
  onAxisChange: (value: string[]) => void;
  onDisplayChange: (value: string) => void;
  onIntervalChange: (value: string | undefined) => void;
  onTopEventsChange: (value: string) => void;

  organization: Organization;
  router: InjectedRouter;
  // chart footer props
  total: number | null;
  yAxis: string[];
};

type ContainerState = {
  yAxisOptions: SelectValue<string>[];
};

class ResultsChartContainer extends Component<ContainerProps, ContainerState> {
  state: ContainerState = {
    yAxisOptions: this.props.eventView.getYAxisOptions(),
  };

  UNSAFE_componentWillReceiveProps(nextProps: any) {
    const yAxisOptions = this.props.eventView.getYAxisOptions();
    const nextYAxisOptions = nextProps.eventView.getYAxisOptions();

    if (!valueIsEqual(yAxisOptions, nextYAxisOptions, true)) {
      this.setState({yAxisOptions: nextYAxisOptions});
    }
  }

  shouldComponentUpdate(nextProps: ContainerProps) {
    const {eventView, ...restProps} = this.props;
    const {eventView: nextEventView, ...restNextProps} = nextProps;

    if (
      !eventView.isEqualTo(nextEventView) ||
      this.props.confirmedQuery !== nextProps.confirmedQuery
    ) {
      return true;
    }

    return !isEqual(restProps, restNextProps);
  }

  render() {
    const {
      api,
      eventView,
      location,
      router,
      total,
      onAxisChange,
      onDisplayChange,
      onIntervalChange,
      onTopEventsChange,
      organization,
      confirmedQuery,
      yAxis,
    } = this.props;

    const {yAxisOptions} = this.state;

    const hasQueryFeature = organization.features.includes('discover-query');
    const displayOptions = eventView
      .getDisplayOptions()
      .filter(opt => {
        // top5 modes are only available with larger packages in saas.
        // We remove instead of disable here as showing tooltips in dropdown
        // menus is clunky.
        if (TOP_EVENT_MODES.includes(opt.value) && !hasQueryFeature) {
          return false;
        }
        return true;
      })
      .map(opt => {
        // Can only use default display or total daily with multi y axis
        if (TOP_EVENT_MODES.includes(opt.value)) {
          opt.label = DisplayModes.TOP5 === opt.value ? 'Top Period' : 'Top Daily';
        }
        if (
          yAxis.length > 1 &&
          !MULTI_Y_AXIS_SUPPORTED_DISPLAY_MODES.includes(opt.value as DisplayModes)
        ) {
          return {
            ...opt,
            disabled: true,
            tooltip: t(
              'Change the Y-Axis dropdown to display only 1 function to use this view.'
            ),
          };
        }
        return opt;
      });

    return (
      <StyledPanel>
        {(yAxis.length > 0 && (
          <CustomMeasurementsContext.Consumer>
            {contextValue => (
              <ResultsChart
                api={api}
                eventView={eventView}
                location={location}
                organization={organization}
                router={router}
                confirmedQuery={confirmedQuery}
                yAxisValue={yAxis}
                customMeasurements={contextValue?.customMeasurements}
              />
            )}
          </CustomMeasurementsContext.Consumer>
        )) || <NoChartContainer>{t('No Y-Axis selected.')}</NoChartContainer>}
        <ChartFooter
          total={total}
          yAxisValue={yAxis}
          yAxisOptions={yAxisOptions}
          eventView={eventView}
          onAxisChange={onAxisChange}
          displayOptions={displayOptions}
          displayMode={eventView.getDisplayMode()}
          onDisplayChange={onDisplayChange}
          onTopEventsChange={onTopEventsChange}
          onIntervalChange={onIntervalChange}
          topEvents={eventView.topEvents ?? TOP_N.toString()}
        />
      </StyledPanel>
    );
  }
}

export default withApi(ResultsChartContainer);

const StyledPanel = styled(Panel)`
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    margin: 0;
  }
`;

const NoChartContainer = styled('div')<{height?: string}>`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  flex: 1;
  flex-shrink: 0;
  overflow: hidden;
  height: ${p => p.height || '200px'};
  position: relative;
  border-color: transparent;
  margin-bottom: 0;
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

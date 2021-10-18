import {Component, Fragment} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import AreaChart from 'app/components/charts/areaChart';
import EventsChart from 'app/components/charts/eventsChart';
import WorldMapChart from 'app/components/charts/worldMapChart';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {Panel} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import {DisplayModes, TOP_N} from 'app/utils/discover/types';
import getDynamicText from 'app/utils/getDynamicText';
import {decodeScalar} from 'app/utils/queryString';
import withApi from 'app/utils/withApi';

import ChartFooter from './chartFooter';

type ResultsChartProps = {
  api: Client;
  router: InjectedRouter;
  organization: Organization;
  eventView: EventView;
  location: Location;
  confirmedQuery: boolean;
  yAxisValue: string[];
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
    const {api, eventView, location, organization, router, confirmedQuery, yAxisValue} =
      this.props;

    const hasPerformanceChartInterpolation = organization.features.includes(
      'performance-chart-interpolation'
    );
    const hasConnectDiscoverAndDashboards = organization.features.includes(
      'connect-discover-and-dashboards'
    );
    const hasTopEvents = organization.features.includes('discover-top-events');

    const globalSelection = eventView.getGlobalSelection();
    const start = globalSelection.datetime.start
      ? getUtcToLocalDateObject(globalSelection.datetime.start)
      : null;

    const end = globalSelection.datetime.end
      ? getUtcToLocalDateObject(globalSelection.datetime.end)
      : null;

    const {utc} = getParams(location.query);
    const apiPayload = eventView.getEventsAPIPayload(location);
    const display = eventView.getDisplayMode();
    const isTopEvents =
      display === DisplayModes.TOP5 || display === DisplayModes.DAILYTOP5;
    const isPeriod = display === DisplayModes.DEFAULT || display === DisplayModes.TOP5;
    const isDaily = display === DisplayModes.DAILYTOP5 || display === DisplayModes.DAILY;
    const isPrevious = display === DisplayModes.PREVIOUS;
    const referrer = `api.discover.${display}-chart`;
    const topEvents =
      hasTopEvents && eventView.topEvents ? parseInt(eventView.topEvents, 10) : TOP_N;
    const chartComponent =
      display === DisplayModes.WORLDMAP
        ? WorldMapChart
        : hasConnectDiscoverAndDashboards && yAxisValue.length > 1 && !isDaily
        ? AreaChart
        : undefined;

    return (
      <Fragment>
        {getDynamicText({
          value: (
            <EventsChart
              api={api}
              router={router}
              query={apiPayload.query}
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
              interval={eventView.interval}
              showDaily={isDaily}
              topEvents={isTopEvents ? topEvents : undefined}
              orderby={isTopEvents ? decodeScalar(apiPayload.sort) : undefined}
              utc={utc === 'true'}
              confirmedQuery={confirmedQuery}
              withoutZerofill={hasPerformanceChartInterpolation}
              chartComponent={chartComponent}
              referrer={referrer}
              fromDiscover
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
  router: InjectedRouter;
  eventView: EventView;
  location: Location;
  organization: Organization;
  confirmedQuery: boolean;
  yAxis: string[];

  // chart footer props
  total: number | null;
  onAxisChange: (value: string[]) => void;
  onDisplayChange: (value: string) => void;
  onTopEventsChange: (value: string) => void;
};

class ResultsChartContainer extends Component<ContainerProps> {
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
      onTopEventsChange,
      organization,
      confirmedQuery,
      yAxis,
    } = this.props;

    const hasQueryFeature = organization.features.includes('discover-query');
    const hasConnectDiscoverAndDashboards = organization.features.includes(
      'connect-discover-and-dashboards'
    );
    const hasTopEvents = organization.features.includes('discover-top-events');
    const displayOptions = eventView
      .getDisplayOptions()
      .filter(opt => {
        // top5 modes are only available with larger packages in saas.
        // We remove instead of disable here as showing tooltips in dropdown
        // menus is clunky.
        if (
          [DisplayModes.TOP5, DisplayModes.DAILYTOP5].includes(
            opt.value as DisplayModes
          ) &&
          !hasQueryFeature
        ) {
          return false;
        }
        if (!hasConnectDiscoverAndDashboards && opt.value === DisplayModes.WORLDMAP) {
          return false;
        }
        return true;
      })
      .map(opt => {
        // Can only use default display or total daily with multi y axis
        if (
          hasTopEvents &&
          [DisplayModes.TOP5, DisplayModes.DAILYTOP5].includes(opt.value as DisplayModes)
        ) {
          opt.label = DisplayModes.TOP5 === opt.value ? 'Top Period' : 'Top Daily';
        }
        if (
          yAxis.length > 1 &&
          ![DisplayModes.DEFAULT, DisplayModes.DAILY, DisplayModes.PREVIOUS].includes(
            opt.value as DisplayModes
          )
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

    const yAxisValue = hasConnectDiscoverAndDashboards ? yAxis : [eventView.getYAxis()];

    return (
      <StyledPanel>
        {(yAxisValue.length > 0 && (
          <ResultsChart
            api={api}
            eventView={eventView}
            location={location}
            organization={organization}
            router={router}
            confirmedQuery={confirmedQuery}
            yAxisValue={yAxisValue}
          />
        )) || <NoChartContainer>{t('No Y-Axis selected.')}</NoChartContainer>}
        <ChartFooter
          organization={organization}
          total={total}
          yAxisValue={yAxisValue}
          yAxisOptions={eventView.getYAxisOptions()}
          onAxisChange={onAxisChange}
          displayOptions={displayOptions}
          displayMode={eventView.getDisplayMode()}
          onDisplayChange={onDisplayChange}
          onTopEventsChange={onTopEventsChange}
          topEvents={eventView.topEvents ?? TOP_N.toString()}
        />
      </StyledPanel>
    );
  }
}

export default withApi(ResultsChartContainer);

const StyledPanel = styled(Panel)`
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
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

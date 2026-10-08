import {Fragment, memo, useContext, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import isEqual from 'lodash/isEqual';

import type {Client} from 'sentry/api';
import {AreaChart} from 'sentry/components/charts/areaChart';
import {BarChart} from 'sentry/components/charts/barChart';
import {EventsChart} from 'sentry/components/charts/eventsChart';
import {getInterval, getPreviousSeriesName} from 'sentry/components/charts/utils';
import type {DroppedDataProps} from 'sentry/components/droppedData/types';
import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
import {useDroppedDataDrawer} from 'sentry/components/droppedData/useDroppedDataDrawer';
import {hasDroppedData} from 'sentry/components/droppedData/utils';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {Panel} from 'sentry/components/panels/panel';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {CustomMeasurementsContext} from 'sentry/utils/customMeasurements/customMeasurementsContext';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import type {EventView} from 'sentry/utils/discover/eventView';
import {getAggregateArg, stripEquationPrefix} from 'sentry/utils/discover/fields';
import {
  DiscoverDatasets,
  DisplayModes,
  MULTI_Y_AXIS_SUPPORTED_DISPLAY_MODES,
  TOP_EVENT_MODES,
  TOP_N,
} from 'sentry/utils/discover/types';
import {getDynamicText} from 'sentry/utils/getDynamicText';
import {decodeScalar} from 'sentry/utils/queryString';
import {useApi} from 'sentry/utils/useApi';
import {isCustomMeasurement} from 'sentry/views/dashboards/utils';
import {ChartFooter} from 'sentry/views/discover/results/chartFooter';

type ResultsChartProps = {
  api: Client;
  confirmedQuery: boolean;
  eventView: EventView;
  location: Location;
  organization: Organization;
  yAxisValue: string[];
  customMeasurements?: CustomMeasurementCollection | undefined;
  droppedData?: DroppedDataProps;
};

function isDailyDisplay(display: string) {
  return display === DisplayModes.DAILYTOP5 || display === DisplayModes.DAILY;
}

function getChartDateRange(eventView: EventView) {
  const {datetime} = eventView.getPageFilters();
  return {
    start: datetime.start ? getUtcToLocalDateObject(datetime.start) : null,
    end: datetime.end ? getUtcToLocalDateObject(datetime.end) : null,
    period: datetime.period,
  };
}

function getResultsChartInterval(eventView: EventView, location: Location): string {
  const display = eventView.getDisplayMode();
  if (isDailyDisplay(display)) {
    return '1d';
  }
  if (eventView.interval) {
    return eventView.interval;
  }
  const {utc} = normalizeDateTimeParams(location.query);
  return getInterval(
    {...getChartDateRange(eventView), utc: utc === 'true'},
    display === DisplayModes.BAR ? 'low' : 'high'
  );
}

const ResultsChart = memo(
  function ResultsChart({
    api,
    eventView,
    location,
    organization,
    confirmedQuery,
    yAxisValue,
    customMeasurements,
    droppedData,
  }: ResultsChartProps) {
    const globalSelection = eventView.getPageFilters();
    const {start, end} = getChartDateRange(eventView);

    const {utc} = normalizeDateTimeParams(location.query);
    const apiPayload = eventView.getEventsAPIPayload(location);
    const display = eventView.getDisplayMode();
    const isTopEvents =
      display === DisplayModes.TOP5 || display === DisplayModes.DAILYTOP5;
    const isPeriod = display === DisplayModes.DEFAULT || display === DisplayModes.TOP5;
    const isDaily = isDailyDisplay(display);
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
        : display === DisplayModes.PREVIOUS
          ? AreaChart
          : customPerformanceMetricFieldType === 'size' && isTopEvents
            ? AreaChart
            : undefined;
    const interval = getResultsChartInterval(eventView, location);

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
              location={location}
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
              chartComponent={chartComponent}
              referrer={referrer}
              fromDiscover
              disableableSeries={disableableSeries}
              droppedData={droppedData}
            />
          ),
          fixed: <Placeholder height="200px" testId="skeleton-ui" />,
        })}
      </Fragment>
    );
  },
  function areEqual(prev: ResultsChartProps, next: ResultsChartProps) {
    const {eventView, ...restPrev} = prev;
    const {eventView: nextEventView, ...restNext} = next;
    if (!eventView.isEqualTo(nextEventView)) {
      return false;
    }
    return isEqual(restPrev, restNext);
  }
);

type ContainerProps = {
  confirmedQuery: boolean;
  eventView: EventView;
  location: Location;
  onAxisChange: (value: string[]) => void;
  onDisplayChange: (value: string) => void;
  onIntervalChange: (value: string | undefined) => void;
  onTopEventsChange: (value: string) => void;

  organization: Organization;
  // chart footer props
  total: number | null;
  yAxis: string[];
};

export const ResultsChartContainer = memo(
  function ResultsChartContainer({
    eventView,
    location,
    total,
    onAxisChange,
    onDisplayChange,
    onIntervalChange,
    onTopEventsChange,
    organization,
    confirmedQuery,
    yAxis,
  }: ContainerProps) {
    const api = useApi();
    const {customMeasurements} = useContext(CustomMeasurementsContext);

    const isErrorsDataset = eventView.dataset === DiscoverDatasets.ERRORS;
    const chartInterval = getResultsChartInterval(eventView, location);
    const {droppedEvents, acceptedEvents} = useDroppedData(
      {dataset: DiscoverDatasets.ERRORS, interval: chartInterval},
      {enabled: isErrorsDataset}
    );
    const [isDroppedDataLayerOn, setIsDroppedDataLayerOn] = useState(true);
    const openDroppedDataDrawer = useDroppedDataDrawer(
      DiscoverDatasets.ERRORS,
      chartInterval
    );
    const canShowDroppedData =
      isErrorsDataset && hasDroppedData(droppedEvents, acceptedEvents);
    const showDroppedDataBand = canShowDroppedData && isDroppedDataLayerOn;
    const droppedData = showDroppedDataBand
      ? {droppedEvents, acceptedEvents, onClick: openDroppedDataDrawer}
      : undefined;

    const yAxisOptions = useMemo(() => eventView.getYAxisOptions(), [eventView]);

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
          <ResultsChart
            api={api}
            eventView={eventView}
            location={location}
            organization={organization}
            confirmedQuery={confirmedQuery}
            yAxisValue={yAxis}
            customMeasurements={customMeasurements}
            droppedData={droppedData}
          />
        )) || <NoChartContainer>{t('No Y-Axis selected.')}</NoChartContainer>}
        <ChartFooter
          droppedDataLayer={
            canShowDroppedData
              ? {
                  showDroppedData: isDroppedDataLayerOn,
                  onChange: setIsDroppedDataLayerOn,
                }
              : undefined
          }
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
  },
  function areContainerEqual(prev: ContainerProps, next: ContainerProps) {
    const {eventView, ...restPrev} = prev;
    const {eventView: nextEventView, ...restNext} = next;
    if (
      !eventView.isEqualTo(nextEventView) ||
      prev.confirmedQuery !== next.confirmedQuery
    ) {
      return false;
    }
    return isEqual(restPrev, restNext);
  }
);

const StyledPanel = styled(Panel)`
  @container (min-width: ${p => p.theme.container['4xl']}) {
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
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.xl};
`;

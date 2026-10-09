import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {IconClock} from '@sentry/icons/clock';
import {IconContract} from '@sentry/icons/contract';
import {IconEllipsis} from '@sentry/icons/ellipsis';
import {IconExpand} from '@sentry/icons/expand';
import {IconGraph} from '@sentry/icons/graph';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import Feature from 'sentry/components/acl/feature';
import {DroppedDataLayerControl} from 'sentry/components/droppedData/droppedDataLayerControl';
import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
import {useDroppedDataDrawer} from 'sentry/components/droppedData/useDroppedDataDrawer';
import {hasDroppedData} from 'sentry/components/droppedData/utils';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {EventView} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/utils/timeSeries/determineSeriesSampleCount';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useIsShortViewport} from 'sentry/utils/useIsShortViewport';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {
  DashboardWidgetSource,
  DEFAULT_WIDGET_NAME,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {plottablesCanBeVisualized} from 'sentry/views/dashboards/widgets/plottablesCanBeVisualized';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {handleAddQueryToDashboard} from 'sentry/views/discover/utils';
import {
  ChartVisualization,
  useChartVisualizationPlottables,
} from 'sentry/views/explore/components/chart/chartVisualization';
import {SamplingWarning} from 'sentry/views/explore/components/chart/samplingWarning';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {CHART_TYPE_TO_DISPLAY_TYPE} from 'sentry/views/explore/hooks/useAddToDashboard';
import {ConfidenceFooter} from 'sentry/views/explore/logs/confidenceFooter';
import {
  useQueryParamsAggregateFields,
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsMode,
  useQueryParamsQuery,
  useQueryParamsSearch,
  useQueryParamsTopEventsLimit,
  useQueryParamsVisualizes,
  useSetQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {isVisualize, type Visualize} from 'sentry/views/explore/queryParams/visualize';
import {EXPLORE_CHART_TYPE_OPTIONS} from 'sentry/views/explore/spans/charts';
import type {RawCounts} from 'sentry/views/explore/useRawCounts';
import {
  combineConfidenceForSeries,
  getSamplingWarningReason,
  prettifyAggregation,
} from 'sentry/views/explore/utils';
import {
  getConditionalFilterInvalidSeriesMessageForYAxis,
  isConditionalAggregateYAxisValid,
} from 'sentry/views/explore/utils/conditionalAggregate';
import {getSaveAsAlertMenuItem} from 'sentry/views/explore/utils/saveAsAlertMenuItem';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {SortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

interface LogsGraphProps {
  rawLogCounts: RawCounts;
  timeseriesResult: SortedTimeSeries;
}

export function LogsGraph({rawLogCounts, timeseriesResult}: LogsGraphProps) {
  const visualizes = useQueryParamsVisualizes();
  const setVisualizes = useSetQueryParamsVisualizes();

  function handleChartTypeChange(index: number, chartType: ChartType) {
    const newVisualizes = visualizes.map((visualize, i) => {
      if (i === index) {
        visualize = visualize.replace({chartType});
      }
      return visualize.serialize();
    });
    setVisualizes(newVisualizes);
  }

  function handleChartVisibilityChange(index: number, visible: boolean) {
    const newVisualizes = visualizes.map((visualize, i) => {
      if (i === index) {
        visualize = visualize.replace({visible});
      }
      return visualize.serialize();
    });
    setVisualizes(newVisualizes);
  }

  return (
    <Fragment>
      {visualizes.map((visualize, index) => {
        return (
          <Graph
            key={index}
            visualize={visualize}
            rawLogCounts={rawLogCounts}
            timeseriesResult={timeseriesResult}
            onChartTypeChange={chartType => handleChartTypeChange(index, chartType)}
            onChartVisibilityChange={visible =>
              handleChartVisibilityChange(index, visible)
            }
          />
        );
      })}
    </Fragment>
  );
}

interface GraphProps extends LogsGraphProps {
  onChartTypeChange: (chartType: ChartType) => void;
  onChartVisibilityChange: (visible: boolean) => void;
  visualize: Visualize;
}

function Graph({
  onChartTypeChange,
  onChartVisibilityChange,
  rawLogCounts,
  timeseriesResult,
  visualize,
}: GraphProps) {
  const isShortViewport = useIsShortViewport();
  const {isEmpty: tableIsEmpty, isPending: tableIsPending} = useLogsPageDataQueryResult();

  const aggregate = visualize.yAxis;
  const userQuery = useQueryParamsQuery();
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const {selection} = usePageFilters();
  const groupBys = useQueryParamsGroupBys();

  const [interval, setInterval, intervalOptions] = useChartInterval();
  const {droppedEvents, acceptedEvents} = useDroppedData({
    dataset: DiscoverDatasets.OURLOGS,
    interval,
  });
  const [isDroppedDataLayerOn, setIsDroppedDataLayerOn] = useState(true);
  const openDroppedDataDrawer = useDroppedDataDrawer({dataset: DiscoverDatasets.OURLOGS});
  const canShowDroppedData = hasDroppedData(droppedEvents, acceptedEvents);
  const showDroppedDataBand =
    canShowDroppedData && isDroppedDataLayerOn && !tableIsEmpty && !tableIsPending;

  // Invalid `_if` filters skip the backend request; surface that as a chart error
  // instead of an empty/no-data state.
  const hasValidConditionalFilter = isConditionalAggregateYAxisValid(aggregate);

  const chartInfo: ChartInfo = useMemo(() => {
    // If the table is empty or pending, we want to withhold the chart data.
    // This is to avoid a state where there is data in the chart but not in
    // the table which is very weird. By withholding the chart data, we create
    // the illusion the 2 are being queries in sync.
    const withholdData = tableIsEmpty || tableIsPending;

    const series =
      withholdData || !hasValidConditionalFilter
        ? []
        : (timeseriesResult.data[aggregate] ?? []);
    const isTopEvents = defined(topEventsLimit);
    const samplingMeta = determineSeriesSampleCountAndIsSampled(series, isTopEvents);
    const resultForChart = (
      hasValidConditionalFilter
        ? {
            ...timeseriesResult,
            isPending: timeseriesResult.isPending || tableIsPending,
          }
        : {
            ...timeseriesResult,
            error: new Error(getConditionalFilterInvalidSeriesMessageForYAxis(aggregate)),
            isError: true,
            isPending: false,
            isLoading: false,
            isFetching: false,
            isSuccess: false,
            status: 'error' as const,
          }
    ) as ChartInfo['timeseriesResult'];
    return {
      chartType: visualize.chartType,
      series,
      timeseriesResult: resultForChart,
      yAxis: aggregate,
      confidence: combineConfidenceForSeries(series),
      dataScanned: samplingMeta.dataScanned,
      isSampled: samplingMeta.isSampled,
      sampleCount: samplingMeta.sampleCount,
      samplingMode: undefined,
      topEvents: isTopEvents ? series.filter(s => !s.meta.isOther).length : undefined,
    };
  }, [
    aggregate,
    hasValidConditionalFilter,
    tableIsEmpty,
    tableIsPending,
    timeseriesResult,
    topEventsLimit,
    visualize.chartType,
  ]);

  const plottables = useChartVisualizationPlottables(chartInfo);

  const Title = (
    <Widget.WidgetTitle
      summary={
        !visualize.visible && plottablesCanBeVisualized(plottables) ? (
          <TimeSeriesWidgetVisualization
            plottables={plottables}
            showLegend="never"
            showXAxis="never"
            showYAxis="never"
          />
        ) : null
      }
      title={prettifyAggregation(aggregate) ?? aggregate}
    />
  );

  const samplingWarningReason = getSamplingWarningReason(
    aggregate,
    chartInfo.series,
    chartInfo.dataScanned
  );
  const TitleBadges = samplingWarningReason ? (
    <SamplingWarning yAxis={aggregate} reason={samplingWarningReason} />
  ) : null;

  const chartIcon =
    visualize.chartType === ChartType.LINE
      ? 'line'
      : visualize.chartType === ChartType.AREA
        ? 'area'
        : 'bar';

  const Actions = visualize.visible ? (
    <Fragment>
      {canShowDroppedData ? (
        <DroppedDataLayerControl
          showDroppedData={isDroppedDataLayerOn}
          onChange={setIsDroppedDataLayerOn}
        />
      ) : null}
      <CompactSelect
        trigger={triggerProps => (
          <OverlayTrigger.Button
            {...triggerProps}
            tooltipProps={{
              title: t('Type of chart displayed in this visualization (ex. line)'),
            }}
            icon={<IconGraph type={chartIcon} />}
            variant="transparent"
            showChevron={false}
            size="xs"
          />
        )}
        value={visualize.chartType}
        menuTitle="Type"
        options={EXPLORE_CHART_TYPE_OPTIONS}
        onChange={option => onChartTypeChange(option.value)}
      />
      <CompactSelect
        value={interval}
        onChange={({value}) => setInterval(value)}
        trigger={triggerProps => (
          <OverlayTrigger.Button
            {...triggerProps}
            tooltipProps={{
              title: t('Time interval displayed in this visualization (ex. 5m)'),
            }}
            icon={<IconClock />}
            variant="transparent"
            showChevron={false}
            size="xs"
          />
        )}
        menuTitle="Interval"
        options={intervalOptions}
      />
      <ContextMenu interval={interval} visualize={visualize} />
      <Button
        aria-label={t('Collapse chart')}
        icon={<IconContract />}
        onClick={() => onChartVisibilityChange(false)}
        size="xs"
      />
    </Fragment>
  ) : (
    <Button
      aria-label={t('Expand chart')}
      icon={<IconExpand />}
      onClick={() => onChartVisibilityChange(true)}
      size="xs"
    />
  );

  const {period, start, end} = selection.datetime;
  const chartRemountKey = `${period}|${start}|${end}|${userQuery}|${aggregate}|${visualize.chartType}|${interval}|${topEventsLimit}|${groupBys.join(',')}`;

  return (
    <Widget
      Title={Title}
      TitleBadges={TitleBadges}
      Actions={Actions}
      Visualization={
        visualize.visible && (
          <ChartVisualization
            key={chartRemountKey}
            chartInfo={chartInfo}
            droppedData={
              showDroppedDataBand
                ? {
                    droppedEvents,
                    acceptedEvents,
                    onClick: openDroppedDataDrawer,
                  }
                : undefined
            }
          />
        )
      }
      Footer={
        visualize.visible && (
          <ConfidenceFooter
            chartInfo={chartInfo}
            // Match chart pending state (includes table withhold + invalid `_if` errors).
            isLoading={chartInfo.timeseriesResult.isPending}
            rawLogCounts={rawLogCounts}
            hasUserQuery={!!userQuery}
            disabled={
              !hasValidConditionalFilter || (tableIsPending ? false : tableIsEmpty)
            }
          />
        )
      }
      height={visualize.visible ? (isShortViewport ? 175 : 200) : 50}
      revealActions="always"
    />
  );
}

function ContextMenu({interval, visualize}: {interval: string; visualize: Visualize}) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();
  const pageFilters = usePageFilters();

  const mode = useQueryParamsMode();
  const search = useQueryParamsSearch();
  const aggregateFields = useQueryParamsAggregateFields();
  const aggregateSortBys = useQueryParamsAggregateSortBys();

  const items = useMemo(() => {
    const project =
      projects.length === 1
        ? projects[0]
        : projects.find(p => p.id === `${pageFilters.selection.projects[0]}`);

    const disableAddToDashboard = !organization.features.includes('dashboards-edit');

    return [
      getSaveAsAlertMenuItem({
        to: getAlertsUrl({
          project,
          query: search.formatString(),
          pageFilters: pageFilters.selection,
          aggregate: visualize.yAxis,
          organization,
          dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
          interval,
          eventTypes: [EventTypes.TRACE_ITEM_LOG],
        }),
        onAction: () => {
          trackAnalytics('logs.save_as', {
            save_type: 'alert',
            ui_source: 'chart',
            organization,
          });
          return;
        },
      }),
      {
        key: 'add-to-dashboard',
        textValue: t('Add to Dashboard'),
        label: (
          <Feature
            overrideName="feature-disabled:dashboards-edit"
            features="organizations:dashboards-edit"
            renderDisabled={() => <DisabledText>{t('Add to Dashboard')}</DisabledText>}
          >
            {t('Add to Dashboard')}
          </Feature>
        ),
        disabled: disableAddToDashboard,
        onAction: () => {
          if (disableAddToDashboard) {
            return;
          }
          trackAnalytics('logs.save_as', {
            save_type: 'dashboard',
            ui_source: 'chart',
            organization,
          });

          const fields =
            mode === Mode.SAMPLES
              ? []
              : aggregateFields
                  .map(aggregateField => {
                    if (isVisualize(aggregateField)) {
                      return aggregateField.yAxis;
                    }
                    if (isGroupBy(aggregateField)) {
                      return aggregateField.groupBy;
                    }
                    return null;
                  })
                  .filter(defined);

          const discoverQuery: NewQuery = {
            name: DEFAULT_WIDGET_NAME,
            fields,
            orderby: aggregateSortBys.map(formatSort),
            query: search.formatString(),
            version: 2,
            dataset: DiscoverDatasets.OURLOGS,
            yAxis: [visualize.yAxis],
          };

          const eventView = EventView.fromNewQueryWithPageFilters(
            discoverQuery,
            pageFilters.selection
          );
          eventView.display = CHART_TYPE_TO_DISPLAY_TYPE[visualize.chartType];

          handleAddQueryToDashboard({
            organization,
            location,
            eventView,
            yAxis: visualize.yAxis,
            widgetType: WidgetType.LOGS,
            source: DashboardWidgetSource.LOGS,
          });
        },
      },
    ];
  }, [
    aggregateFields,
    aggregateSortBys,
    interval,
    location,
    mode,
    organization,
    pageFilters,
    projects,
    search,
    visualize.chartType,
    visualize.yAxis,
  ]);

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          size="xs"
          variant="transparent"
          icon={<IconEllipsis />}
          aria-label={t('Chart actions')}
        />
      )}
      position="bottom-end"
      items={items}
    />
  );
}

const DisabledText = styled('span')`
  color: ${p => p.theme.tokens.content.disabled};
`;

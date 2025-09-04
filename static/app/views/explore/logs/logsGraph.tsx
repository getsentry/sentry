import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconClock, IconEllipsis, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {
  DashboardWidgetSource,
  DEFAULT_WIDGET_NAME,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {handleAddQueryToDashboard} from 'sentry/views/discover/utils';
import {ChartVisualization} from 'sentry/views/explore/components/chart/chartVisualization';
import {useLogsSearch} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {
  ChartIntervalUnspecifiedStrategy,
  useChartInterval,
} from 'sentry/views/explore/hooks/useChartInterval';
import {TOP_EVENTS_LIMIT} from 'sentry/views/explore/hooks/useTopEvents';
import {ConfidenceFooter} from 'sentry/views/explore/logs/confidenceFooter';
import {
  useQueryParamsAggregateFields,
  useQueryParamsAggregateSortBys,
  useQueryParamsMode,
  useQueryParamsTopEventsLimit,
  useQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {isVisualize, type Visualize} from 'sentry/views/explore/queryParams/visualize';
import {EXPLORE_CHART_TYPE_OPTIONS} from 'sentry/views/explore/spans/charts';
import {
  combineConfidenceForSeries,
  prettifyAggregation,
} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

interface LogsGraphProps {
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
}

export function LogsGraph({timeseriesResult}: LogsGraphProps) {
  const visualizes = useQueryParamsVisualizes();

  return (
    <Fragment>
      {visualizes.map((visualize, index) => {
        return (
          <Graph key={index} visualize={visualize} timeseriesResult={timeseriesResult} />
        );
      })}
    </Fragment>
  );
}

interface GraphProps extends LogsGraphProps {
  visualize: Visualize;
}

function Graph({timeseriesResult, visualize}: GraphProps) {
  const aggregate = visualize.yAxis;
  const topEventsLimit = useQueryParamsTopEventsLimit();

  const [visible, setVisible] = useState(true);
  const [chartType, setChartType] = useState<ChartType>(ChartType.BAR);
  const [interval, setInterval, intervalOptions] = useChartInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_SMALLEST,
  });

  const chartInfo = useMemo(() => {
    const series = timeseriesResult.data[aggregate] ?? [];
    const isTopEvents = defined(topEventsLimit);
    const samplingMeta = determineSeriesSampleCountAndIsSampled(series, isTopEvents);
    return {
      chartType,
      series,
      timeseriesResult,
      yAxis: aggregate,
      confidence: combineConfidenceForSeries(series),
      dataScanned: samplingMeta.dataScanned,
      isSampled: samplingMeta.isSampled,
      sampleCount: samplingMeta.sampleCount,
      samplingMode: undefined,
      topEvents: isTopEvents ? TOP_EVENTS_LIMIT : undefined,
    };
  }, [chartType, timeseriesResult, aggregate, topEventsLimit]);

  const Title = (
    <Widget.WidgetTitle title={prettifyAggregation(aggregate) ?? aggregate} />
  );

  const chartIcon =
    chartType === ChartType.LINE ? 'line' : chartType === ChartType.AREA ? 'area' : 'bar';

  const Actions = (
    <Fragment>
      <Tooltip title={t('Type of chart displayed in this visualization (ex. line)')}>
        <CompactSelect
          triggerProps={{
            icon: <IconGraph type={chartIcon} />,
            borderless: true,
            showChevron: false,
            size: 'xs',
          }}
          value={chartType}
          menuTitle="Type"
          options={EXPLORE_CHART_TYPE_OPTIONS}
          onChange={option => setChartType(option.value)}
        />
      </Tooltip>
      <Tooltip title={t('Time interval displayed in this visualization (ex. 5m)')}>
        <CompactSelect
          value={interval}
          onChange={({value}) => setInterval(value)}
          triggerProps={{
            icon: <IconClock />,
            borderless: true,
            showChevron: false,
            size: 'xs',
          }}
          menuTitle="Interval"
          options={intervalOptions}
        />
      </Tooltip>
      <ContextMenu
        interval={interval}
        visualize={visualize}
        visible={visible}
        setVisible={setVisible}
      />
    </Fragment>
  );

  return (
    <Widget
      Title={Title}
      Actions={Actions}
      Visualization={visible && <ChartVisualization chartInfo={chartInfo} />}
      Footer={
        visible && (
          <ConfidenceFooter
            chartInfo={chartInfo}
            isLoading={timeseriesResult.isLoading}
          />
        )
      }
      height={visible ? 200 : 50}
      revealActions="always"
    />
  );
}

function ContextMenu({
  interval,
  visualize,
  visible,
  setVisible,
}: {
  interval: string;
  setVisible: (visible: boolean) => void;
  visible: boolean;
  visualize: Visualize;
}) {
  const location = useLocation();
  const router = useRouter();
  const organization = useOrganization();
  const {projects} = useProjects();
  const pageFilters = usePageFilters();

  const mode = useQueryParamsMode();
  const search = useLogsSearch();
  const aggregateFields = useQueryParamsAggregateFields();
  const aggregateSortBys = useQueryParamsAggregateSortBys();

  const items: MenuItemProps[] = useMemo(() => {
    const project =
      projects.length === 1
        ? projects[0]
        : projects.find(p => p.id === `${pageFilters.selection.projects[0]}`);

    const menuItems = [];

    menuItems.push({
      key: 'create-alert',
      textValue: t('Create an Alert'),
      label: t('Create an Alert'),
      to: getAlertsUrl({
        project,
        query: search.formatString(),
        pageFilters: pageFilters.selection,
        aggregate: visualize.yAxis,
        organization,
        dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
        interval,
        eventTypes: 'trace_item_log',
      }),
      onAction: () => {
        trackAnalytics('logs.save_as', {
          save_type: 'alert',
          ui_source: 'chart',
          organization,
        });
        return undefined;
      },
    });

    const disableAddToDashboard = !organization.features.includes('dashboards-edit');
    menuItems.push({
      key: 'add-to-dashboard',
      textValue: t('Add to Dashboard'),
      label: (
        <Feature
          hookName="feature-disabled:dashboards-edit"
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
        // the chart currently track the chart type internally so force bar type for now
        eventView.display = DisplayType.BAR;

        handleAddQueryToDashboard({
          organization,
          location,
          eventView,
          router,
          yAxis: visualize.yAxis,
          widgetType: WidgetType.LOGS,
          source: DashboardWidgetSource.LOGS,
        });
      },
    });

    if (visible) {
      menuItems.push({
        key: 'hide-chart',
        textValue: t('Hide Chart'),
        label: t('Hide Chart'),
        onAction: () => setVisible(false),
      });
    } else {
      menuItems.push({
        key: 'show-chart',
        textValue: t('Show Chart'),
        label: t('Show Chart'),
        onAction: () => setVisible(true),
      });
    }

    return menuItems;
  }, [
    aggregateFields,
    aggregateSortBys,
    interval,
    location,
    mode,
    organization,
    pageFilters,
    projects,
    router,
    search,
    setVisible,
    visible,
    visualize.yAxis,
  ]);

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      triggerProps={{
        size: 'xs',
        borderless: true,
        showChevron: false,
        icon: <IconEllipsis />,
      }}
      position="bottom-end"
      items={items}
    />
  );
}

const DisabledText = styled('span')`
  color: ${p => p.theme.disabled};
`;

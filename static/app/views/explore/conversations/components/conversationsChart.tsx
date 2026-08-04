import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {parseAsBoolean, parseAsStringLiteral, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import Feature from 'sentry/components/acl/feature';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconClock, IconContract, IconEllipsis, IconExpand, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {EventView} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {markDelayedData} from 'sentry/utils/timeSeries/markDelayedData';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {
  ChartIntervalUnspecifiedStrategy,
  useChartInterval,
} from 'sentry/utils/useChartInterval';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {
  DashboardWidgetSource,
  DEFAULT_WIDGET_NAME,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {MISSING_DATA_MESSAGE} from 'sentry/views/dashboards/widgets/common/settings';
import {plottablesCanBeVisualized} from 'sentry/views/dashboards/widgets/plottablesCanBeVisualized';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {handleAddQueryToDashboard} from 'sentry/views/discover/utils';
import {Referrer} from 'sentry/views/explore/conversations/utils/referrers';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {INGESTION_DELAY} from 'sentry/views/insights/settings';
import {SpanFields} from 'sentry/views/insights/types';

const CONVERSATION_SPANS_FILTER = `has:${SpanFields.GEN_AI_CONVERSATION_ID}`;
const AI_CLIENT_FILTER = `${SpanFields.GEN_AI_OPERATION_TYPE}:ai_client`;

const CHART_VISUALIZATIONS = {
  cost: {
    label: t('Cost'),
    yAxis: `sum(${SpanFields.GEN_AI_COST_TOTAL_TOKENS})`,
    filter: `${CONVERSATION_SPANS_FILTER} ${AI_CLIENT_FILTER}`,
  },
  messages: {
    label: t('Total Messages'),
    yAxis: `count(${SpanFields.SPAN_DURATION})`,
    filter: `${CONVERSATION_SPANS_FILTER} ${AI_CLIENT_FILTER}`,
  },
  chats: {
    label: t('Individual Chats'),
    yAxis: `count_unique(${SpanFields.GEN_AI_CONVERSATION_ID})`,
    filter: CONVERSATION_SPANS_FILTER,
  },
} as const satisfies Record<string, {filter: string; label: string; yAxis: string}>;

type ChartVisualizationKey = keyof typeof CHART_VISUALIZATIONS;

type ChartTypeKey = 'line' | 'area' | 'bar';

const VISUALIZATION_OPTIONS = Object.entries(CHART_VISUALIZATIONS).map(
  ([value, {label}]) => ({value: value as ChartVisualizationKey, label})
);

const CHART_TYPE_OPTIONS = [
  {value: 'line' as const, label: t('Line')},
  {value: 'area' as const, label: t('Area')},
  {value: 'bar' as const, label: t('Bar')},
];

const CHART_TYPE_TO_DISPLAY_TYPE: Record<ChartTypeKey, DisplayType> = {
  line: DisplayType.LINE,
  area: DisplayType.AREA,
  bar: DisplayType.BAR,
};

const visualizationParser = parseAsStringLiteral(
  Object.keys(CHART_VISUALIZATIONS) as ChartVisualizationKey[]
).withDefault('cost');

const chartTypeParser = parseAsStringLiteral([
  'line',
  'area',
  'bar',
] as const).withDefault('bar');

const collapsedParser = parseAsBoolean.withDefault(false);

export function ConversationsChart() {
  const [visualization, setVisualization] = useQueryState(
    'chartVisualization',
    visualizationParser
  );
  const [chartType, setChartType] = useQueryState('chartType', chartTypeParser);
  const [collapsed, setCollapsed] = useQueryState('chartCollapsed', collapsedParser);
  const [interval, setInterval, intervalOptions] = useChartInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_BIGGEST,
  });

  const {label, yAxis, filter} = CHART_VISUALIZATIONS[visualization];
  const query = useCombinedQuery(filter);

  const {data, isPending, error} = useFetchSpanTimeSeries(
    {
      yAxis: [yAxis],
      query,
      interval,
    },
    Referrer.CHART
  );

  const timeSeries = data?.timeSeries[0];

  const plottables = useMemo(() => {
    if (!timeSeries) {
      return [];
    }
    const PlottableConstructor =
      chartType === 'line' ? Line : chartType === 'area' ? Area : Bars;
    return [
      new PlottableConstructor(markDelayedData(timeSeries, INGESTION_DELAY), {
        alias: label,
      }),
    ];
  }, [timeSeries, chartType, label]);

  const chartTypeLabel =
    CHART_TYPE_OPTIONS.find(option => option.value === chartType)?.label ?? '';
  const intervalLabel =
    intervalOptions.find(option => option.value === interval)?.label ?? interval;

  const visualizationSelect = (
    <CompactSelect
      trigger={triggerProps => (
        <TitleTrigger {...triggerProps} variant="transparent" size="xs">
          <Heading as="h3" size="lg">
            {label}
          </Heading>
        </TitleTrigger>
      )}
      value={visualization}
      options={VISUALIZATION_OPTIONS}
      onChange={option => setVisualization(option.value)}
    />
  );

  // When collapsed, drop the interactive dropdown for a compact title and keep
  // the trend visible as a mini sparkline that fits the header, mirroring the
  // logs chart.
  const Title = collapsed ? (
    <Widget.WidgetTitle
      title={label}
      summary={
        plottablesCanBeVisualized(plottables) ? (
          <TimeSeriesWidgetVisualization
            plottables={plottables}
            showLegend="never"
            showXAxis="never"
            showYAxis="never"
          />
        ) : null
      }
    />
  ) : (
    visualizationSelect
  );

  const Actions = collapsed ? (
    <Button
      aria-label={t('Expand chart')}
      icon={<IconExpand />}
      onClick={() => setCollapsed(false)}
      size="xs"
    />
  ) : (
    <Fragment>
      <Tooltip title={t('Type of chart displayed in this visualization (ex. line)')}>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              icon={<IconGraph type={chartType} />}
              variant="transparent"
              size="xs"
            >
              {chartTypeLabel}
            </OverlayTrigger.Button>
          )}
          value={chartType}
          menuTitle={t('Type')}
          options={CHART_TYPE_OPTIONS}
          onChange={option => setChartType(option.value)}
        />
      </Tooltip>
      <Tooltip title={t('Time interval displayed in this visualization (ex. 5m)')}>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              icon={<IconClock />}
              variant="transparent"
              size="xs"
            >
              {intervalLabel}
            </OverlayTrigger.Button>
          )}
          value={interval}
          menuTitle={t('Interval')}
          options={intervalOptions}
          onChange={option => setInterval(option.value)}
        />
      </Tooltip>
      <ContextMenu
        yAxis={yAxis}
        chartType={chartType}
        query={query}
        interval={interval}
      />
      <Button
        aria-label={t('Collapse chart')}
        icon={<IconContract />}
        onClick={() => setCollapsed(true)}
        size="xs"
      />
    </Fragment>
  );

  const Visualization = isPending ? (
    <TimeSeriesWidgetVisualization.LoadingPlaceholder />
  ) : error ? (
    <Container position="absolute" inset={0}>
      <Widget.WidgetError error={error} />
    </Container>
  ) : plottables.length === 0 ? (
    <Container position="absolute" inset={0}>
      <Widget.WidgetError error={MISSING_DATA_MESSAGE} />
    </Container>
  ) : (
    <TimeSeriesWidgetVisualization plottables={plottables} />
  );

  return (
    <Widget
      Title={Title}
      Actions={Actions}
      Visualization={collapsed ? null : Visualization}
      height={collapsed ? 50 : 195}
      revealActions="always"
    />
  );
}

function ContextMenu({
  yAxis,
  chartType,
  query,
  interval,
}: {
  chartType: ChartTypeKey;
  interval: string;
  query: string;
  yAxis: string;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();
  const pageFilters = usePageFilters();

  const items: MenuItemProps[] = useMemo(() => {
    const project =
      projects.length === 1
        ? projects[0]
        : projects.find(p => p.id === `${pageFilters.selection.projects[0]}`);

    const disableAddToDashboard = !organization.features.includes('dashboards-edit');

    const newAlertLabel = t('Create a Monitor');

    return [
      {
        key: 'create-alert',
        textValue: newAlertLabel,
        label: newAlertLabel,
        to: getAlertsUrl({
          project,
          query,
          pageFilters: pageFilters.selection,
          aggregate: yAxis,
          organization,
          dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
          interval,
        }),
        onAction: () => {
          trackAnalytics('conversations.save_as', {
            save_type: 'alert',
            organization,
          });
        },
      },
      {
        key: 'add-to-dashboard',
        textValue: t('Add to Dashboard'),
        label: (
          <Feature
            overrideName="feature-disabled:dashboards-edit"
            features="organizations:dashboards-edit"
            renderDisabled={() => <Text variant="muted">{t('Add to Dashboard')}</Text>}
          >
            {t('Add to Dashboard')}
          </Feature>
        ),
        disabled: disableAddToDashboard,
        onAction: () => {
          if (disableAddToDashboard) {
            return;
          }
          trackAnalytics('conversations.save_as', {
            save_type: 'dashboard',
            organization,
          });

          const discoverQuery: NewQuery = {
            name: DEFAULT_WIDGET_NAME,
            fields: [yAxis],
            query,
            version: 2,
            dataset: DiscoverDatasets.SPANS,
            yAxis: [yAxis],
          };

          const eventView = EventView.fromNewQueryWithPageFilters(
            discoverQuery,
            pageFilters.selection
          );
          eventView.dataset = DiscoverDatasets.SPANS;
          eventView.display = CHART_TYPE_TO_DISPLAY_TYPE[chartType];

          handleAddQueryToDashboard({
            organization,
            location,
            eventView,
            yAxis: eventView.yAxis,
            widgetType: WidgetType.SPANS,
            source: DashboardWidgetSource.INSIGHTS,
          });
        },
      },
    ];
  }, [chartType, interval, location, organization, pageFilters, projects, query, yAxis]);

  return (
    <DropdownMenu
      triggerProps={{
        'aria-label': t('Chart actions'),
        size: 'xs',
        variant: 'transparent',
        showChevron: false,
        icon: <IconEllipsis />,
      }}
      position="bottom-end"
      items={items}
    />
  );
}

// Pull the trigger left so the label's text edge aligns with the chart's
// left edge, rather than being indented by the button's own padding.
const TitleTrigger = styled(OverlayTrigger.Button)`
  margin-left: -${p => p.theme.space.xs};
`;

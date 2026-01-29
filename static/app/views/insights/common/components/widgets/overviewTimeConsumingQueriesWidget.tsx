import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import {getIntervalForTimeSeriesQuery} from 'sentry/utils/timeSeries/getIntervalForTimeSeriesQuery';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {BaseChartActionDropdown} from 'sentry/views/insights/common/components/chartActionDropdown';
import {ModalChartContainer} from 'sentry/views/insights/common/components/insightsChartContainer';
import {SpanDescriptionCell} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import {TimeSpentCell} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import type {AddToSpanDashboardOptions} from 'sentry/views/insights/common/utils/useAddToSpanDashboard';
import {useAlertsProject} from 'sentry/views/insights/common/utils/useAlertsProject';
import {SupportedDatabaseSystem} from 'sentry/views/insights/database/utils/constants';
import {Referrer} from 'sentry/views/insights/pages/backend/referrers';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {useReleaseBubbleProps} from 'sentry/views/insights/pages/platform/shared/getReleaseBubbleProps';
import {
  SeriesColorIndicator,
  WidgetFooterTable,
} from 'sentry/views/insights/pages/platform/shared/styles';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';
import {WidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export default function OverviewTimeConsumingQueriesWidget(
  props: LoadableChartWidgetProps
) {
  const theme = useTheme();
  const {query} = useTransactionNameQuery();
  const releaseBubbleProps = useReleaseBubbleProps(props);
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const project = useAlertsProject();
  const supportedSystems = Object.values(SupportedDatabaseSystem);

  const search = new MutableSearch(
    `${SpanFields.DB_SYSTEM}:[${supportedSystems.join(',')}] ${query}`.trim()
  );
  const referrer = Referrer.OVERVIEW_TIME_CONSUMING_QUERIES_WIDGET;
  const groupBy = SpanFields.NORMALIZED_DESCRIPTION;
  const yAxes = `p75(${SpanFields.SPAN_DURATION})`;
  const totalTimeField = `sum(${SpanFields.SPAN_SELF_TIME})`;
  const title = t('Queries by Time Spent');
  const interval = getIntervalForTimeSeriesQuery(yAxes, selection.datetime);

  const {
    data: queriesListData,
    isLoading: isQueriesListLoading,
    error: queriesListError,
  } = useSpans(
    {
      fields: [
        SpanFields.PROJECT_ID,
        SpanFields.NORMALIZED_DESCRIPTION,
        SpanFields.SPAN_GROUP,
        SpanFields.DB_SYSTEM,
        'time_spent_percentage()',
        totalTimeField,
      ],
      sorts: [{field: totalTimeField, kind: 'desc'}],
      search,
      limit: 3,
      noPagination: true,
    },
    referrer
  );

  const {
    data: queriesSeriesData,
    isLoading: isQueriesSeriesLoading,
    error: queriesSeriesError,
  } = useFetchSpanTimeSeries(
    {
      query: `${SpanFields.SPAN_GROUP}:[${queriesListData?.map(item => `"${item[SpanFields.SPAN_GROUP]}"`).join(',')}]`,
      groupBy: [groupBy],
      yAxis: [yAxes],
      topEvents: 3,
      enabled: queriesListData?.length > 0,
      interval,
    },
    referrer
  );

  const isLoading = isQueriesSeriesLoading || isQueriesListLoading;
  const error = queriesSeriesError || queriesListError;
  const dataLength = queriesSeriesData?.timeSeries?.length ?? 0;

  const hasData = queriesListData && queriesListData.length > 0 && dataLength > 0;

  const colorPalette = theme.chart.getColorPalette(dataLength - 1);

  const plottables =
    queriesSeriesData?.timeSeries.map(
      (ts, index) =>
        new Line(ts, {
          color: colorPalette[index],
        })
    ) ?? [];

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={isLoading}
      error={error}
      emptyMessage={<WidgetEmptyStateWarning />}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        id: 'overviewTimeConsumingQueriesWidget',
        showLegend: props.loaderSource === 'releases-drawer' ? 'auto' : 'never',
        plottables,
        ...props,
        ...releaseBubbleProps,
      }}
    />
  );

  const footer = hasData && (
    <WidgetFooterTable>
      {queriesListData?.map((item, index) => (
        <Fragment
          key={`${item[SpanFields.PROJECT_ID]}-${item[SpanFields.NORMALIZED_DESCRIPTION]}`}
        >
          <div>
            <SeriesColorIndicator
              style={{
                backgroundColor: colorPalette[index],
              }}
            />
          </div>
          <SpanDescriptionCell
            projectId={Number(item[SpanFields.PROJECT_ID])}
            group={item[SpanFields.SPAN_GROUP]}
            description={item[SpanFields.NORMALIZED_DESCRIPTION]}
            moduleName={ModuleName.DB}
          />
          <TimeSpentCell
            percentage={item['time_spent_percentage()']}
            total={item[totalTimeField]}
            op="db"
          />
        </Fragment>
      ))}
    </WidgetFooterTable>
  );

  const exploreUrl = getExploreUrl({
    selection,
    organization,
    visualize: [
      {
        chartType: ChartType.LINE,
        yAxes: [yAxes],
      },
      {
        chartType: ChartType.LINE,
        yAxes: [totalTimeField],
      },
    ],
    mode: Mode.AGGREGATE,
    title,
    query: search?.formatString(),
    sort: `-${totalTimeField}`,
    groupBy: [groupBy],
    interval,
    referrer,
  });

  const addToDashboardOptions: AddToSpanDashboardOptions = {
    chartType: ChartType.LINE,
    yAxes: [yAxes],
    widgetName: title,
    groupBy: [groupBy],
    search,
    sort: {field: totalTimeField, kind: 'desc'},
    topEvents: 3,
  };

  return (
    <Widget
      Title={<Widget.WidgetTitle title={title} />}
      Visualization={visualization}
      Actions={
        hasData && (
          <Widget.WidgetToolbar>
            <Fragment>
              <BaseChartActionDropdown
                key="time consuming queries widget"
                exploreUrl={exploreUrl}
                referrer={referrer}
                addToDashboardOptions={addToDashboardOptions}
                alertMenuOptions={plottables.map(plottable => ({
                  key: plottable.name,
                  label: ellipsize(plottable.name, 90),
                  to: getAlertsUrl({
                    project,
                    aggregate: yAxes,
                    organization,
                    pageFilters: selection,
                    dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
                    query: `${plottable.timeSeries.groupBy?.[0]?.key}:"${plottable.timeSeries.groupBy?.[0]?.value}"`,
                    referrer,
                  }),
                }))}
              />
              <Button
                size="xs"
                aria-label={t('Open Full-Screen View')}
                priority="transparent"
                icon={<IconExpand />}
                onClick={() => {
                  openInsightChartModal({
                    title,
                    footer,
                    children: <ModalChartContainer>{visualization}</ModalChartContainer>,
                  });
                }}
              />
            </Fragment>
          </Widget.WidgetToolbar>
        )
      }
      noFooterPadding
      Footer={props.loaderSource === 'releases-drawer' ? undefined : footer}
    />
  );
}

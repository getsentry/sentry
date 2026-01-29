import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
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
import {getResourcesEventViewQuery} from 'sentry/views/insights/browser/common/queries/useResourcesQuery';
import {DEFAULT_RESOURCE_TYPES} from 'sentry/views/insights/browser/resources/settings';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {BaseChartActionDropdown} from 'sentry/views/insights/common/components/chartActionDropdown';
import {SpanDescriptionCell} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import {TimeSpentCell} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import type {AddToSpanDashboardOptions} from 'sentry/views/insights/common/utils/useAddToSpanDashboard';
import {useAlertsProject} from 'sentry/views/insights/common/utils/useAlertsProject';
import {Referrer} from 'sentry/views/insights/pages/frontend/referrers';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {useReleaseBubbleProps} from 'sentry/views/insights/pages/platform/shared/getReleaseBubbleProps';
import {
  ModalChartContainer,
  SeriesColorIndicator,
  WidgetFooterTable,
} from 'sentry/views/insights/pages/platform/shared/styles';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';
import {WidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export default function OverviewAssetsByTimeSpentWidget(props: LoadableChartWidgetProps) {
  const theme = useTheme();
  const {query} = useTransactionNameQuery();
  const releaseBubbleProps = useReleaseBubbleProps(props);
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const project = useAlertsProject();

  const resourceQuery = getResourcesEventViewQuery({}, DEFAULT_RESOURCE_TYPES).join(' ');
  const search = new MutableSearch(`has:span.group ${resourceQuery} ${query}`);
  const referrer = Referrer.ASSETS_BY_TIME_SPENT;
  const groupBy = SpanFields.NORMALIZED_DESCRIPTION;
  const yAxes = 'p75(span.duration)';
  const totalTimeField = 'sum(span.duration)';
  const title = t('Assets by Time Spent');
  const interval = getIntervalForTimeSeriesQuery(yAxes, selection.datetime);
  const chartType = ChartType.LINE;
  const topEvents = 3;

  const {
    data: assetListData,
    isLoading: isAssetListLoading,
    error: assetListError,
  } = useSpans(
    {
      fields: [
        SpanFields.SPAN_GROUP,
        SpanFields.PROJECT_ID,
        SpanFields.NORMALIZED_DESCRIPTION,
        'time_spent_percentage()',
        totalTimeField,
      ],
      sorts: [{field: totalTimeField, kind: 'desc'}],
      search,
      limit: topEvents,
      noPagination: true,
    },
    referrer
  );

  const {
    data: assetSeriesData,
    isLoading: isAssetSeriesLoading,
    error: assetSeriesError,
  } = useFetchSpanTimeSeries(
    {
      query: `${SpanFields.SPAN_GROUP}:[${assetListData?.map(item => `"${item[SpanFields.SPAN_GROUP]}"`).join(',')}]`,
      groupBy: [groupBy],
      yAxis: [yAxes],
      topEvents,
      sort: {field: yAxes, kind: 'desc'},
      enabled: assetListData?.length > 0,
      interval,
    },
    referrer
  );

  const assetTimeSeries = assetSeriesData?.timeSeries ?? [];

  const isLoading = isAssetSeriesLoading || isAssetListLoading;
  const error = assetSeriesError || assetListError;

  const hasData =
    assetListData && assetListData.length > 0 && assetTimeSeries?.length > 0;

  const colorPalette = theme.chart.getColorPalette(assetTimeSeries.length - 1);

  const plottables = assetTimeSeries.map(
    (ts, index) => new Line(ts, {color: colorPalette[index]})
  );

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={isLoading}
      error={error}
      emptyMessage={<WidgetEmptyStateWarning />}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        id: 'overviewSlowAssetsWidget',
        showLegend: props.loaderSource === 'releases-drawer' ? 'auto' : 'never',
        plottables,
        ...props,
        ...releaseBubbleProps,
      }}
    />
  );

  const footer = hasData && (
    <WidgetFooterTable>
      {assetListData?.map((item, index) => (
        <Fragment
          key={`${item[SpanFields.PROJECT_ID]}-${item[SpanFields.SPAN_GROUP]}-${item[SpanFields.NORMALIZED_DESCRIPTION]}`}
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
            moduleName={ModuleName.RESOURCE}
          />
          <TimeSpentCell
            percentage={item['time_spent_percentage()']}
            total={item[totalTimeField]}
            op="resource"
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
        chartType,
        yAxes: [yAxes],
      },
    ],
    mode: Mode.AGGREGATE,
    title,
    query: search?.formatString(),
    sort: undefined,
    groupBy: [groupBy],
    interval,
    referrer,
  });

  const addToDashboardOptions: AddToSpanDashboardOptions = {
    chartType,
    yAxes: [yAxes],
    widgetName: title,
    groupBy: [groupBy],
    search,
    sort: {field: totalTimeField, kind: 'desc'},
    topEvents,
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
                key="slow assets widget"
                exploreUrl={exploreUrl}
                referrer={referrer}
                addToDashboardOptions={addToDashboardOptions}
                alertMenuOptions={plottables.map(plottable => {
                  const timeSeries = plottable.timeSeries;
                  const normalizedDescription = timeSeries.groupBy?.[0]?.value;
                  return {
                    key: plottable.name,
                    label: plottable.name,
                    to: getAlertsUrl({
                      project,
                      aggregate: yAxes,
                      organization,
                      pageFilters: selection,
                      dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
                      query: `${SpanFields.NORMALIZED_DESCRIPTION}:${normalizedDescription}`,
                      referrer,
                    }),
                  };
                })}
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

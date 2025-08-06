import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import Duration from 'sentry/components/duration';
import {t} from 'sentry/locale';
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
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useTopNSpanSeries} from 'sentry/views/insights/common/queries/useTopNDiscoverSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import {useAlertsProject} from 'sentry/views/insights/common/utils/useAlertsProject';
import {Referrer} from 'sentry/views/insights/pages/frontend/referrers';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {useReleaseBubbleProps} from 'sentry/views/insights/pages/platform/shared/getReleaseBubbleProps';
import {
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
  const yAxes = 'sum(span.self_time)';
  const totalTimeField = 'sum(span.self_time)';

  const {
    data: assetListData,
    isLoading: isAssetListLoading,
    error: assetListError,
  } = useSpans(
    {
      fields: [
        'span.group',
        'project.id',
        'sentry.normalized_description',
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
    data: assetSeriesData,
    isLoading: isAssetSeriesLoading,
    error: assetSeriesError,
  } = useTopNSpanSeries(
    {
      search: `span.group:[${assetListData?.map(item => `"${item['span.group']}"`).join(',')}]`,
      fields: [groupBy, yAxes],
      yAxis: [yAxes],
      sort: {field: yAxes, kind: 'desc'},
      topN: 3,
      enabled: assetListData?.length > 0,
    },
    referrer
  );

  const isLoading = isAssetSeriesLoading || isAssetListLoading;
  const error = assetSeriesError || assetListError;

  const hasData = assetListData && assetListData.length > 0 && assetSeriesData.length > 0;

  const colorPalette = theme.chart.getColorPalette(assetSeriesData.length - 1);

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
        plottables: assetSeriesData.map(
          (ts, index) =>
            new Line(convertSeriesToTimeseries(ts), {
              color: colorPalette[index],
            })
        ),
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
          <div>
            <SpanDescriptionCell
              projectId={Number(item[SpanFields.PROJECT_ID])}
              group={item[SpanFields.SPAN_GROUP]}
              description={item[SpanFields.NORMALIZED_DESCRIPTION]}
              moduleName={ModuleName.RESOURCE}
            />
          </div>
          <Duration
            seconds={(item[totalTimeField] ?? 0) / 1000}
            fixedDigits={2}
            abbreviation
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
    ],
    mode: Mode.AGGREGATE,
    title: t('Assets by Time Spent'),
    query: search?.formatString(),
    sort: undefined,
    groupBy: [groupBy],
    referrer,
  });

  const chartActions = (
    <BaseChartActionDropdown
      key="slow assets widget"
      exploreUrl={exploreUrl}
      referrer={referrer}
      alertMenuOptions={assetSeriesData.map(series => ({
        key: series.seriesName,
        label: series.seriesName,
        to: getAlertsUrl({
          project,
          aggregate: yAxes,
          organization,
          pageFilters: selection,
          dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
          query: `${SpanFields.NORMALIZED_DESCRIPTION}:${series.seriesName}`,
          referrer,
        }),
      }))}
    />
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Assets by Time Spent')} />}
      Visualization={visualization}
      Actions={hasData && <Widget.WidgetToolbar>{chartActions}</Widget.WidgetToolbar>}
      noFooterPadding
      Footer={props.loaderSource === 'releases-drawer' ? undefined : footer}
    />
  );
}

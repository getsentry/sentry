import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {getResourcesEventViewQuery} from 'sentry/views/insights/browser/common/queries/useResourcesQuery';
import {DEFAULT_RESOURCE_TYPES} from 'sentry/views/insights/browser/resources/settings';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {ChartActionDropdown} from 'sentry/views/insights/common/components/chartActionDropdown';
import {SpanDescriptionCell} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useTopNSpanSeries} from 'sentry/views/insights/common/queries/useTopNDiscoverSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {Referrer} from 'sentry/views/insights/pages/frontend/referrers';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {useReleaseBubbleProps} from 'sentry/views/insights/pages/platform/shared/getReleaseBubbleProps';
import {
  SeriesColorIndicator,
  WidgetFooterTable,
} from 'sentry/views/insights/pages/platform/shared/styles';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';
import {TimeSpentInDatabaseWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export default function OverviewAssetsByTimeSpentWidget(props: LoadableChartWidgetProps) {
  const theme = useTheme();
  const {query} = useTransactionNameQuery();
  const releaseBubbleProps = useReleaseBubbleProps(props);

  const resourceQuery = getResourcesEventViewQuery({}, DEFAULT_RESOURCE_TYPES).join(' ');

  const search = new MutableSearch(`has:span.group ${resourceQuery} ${query}`);

  const assetRequest = useSpans(
    {
      fields: [
        'span.group',
        'project.id',
        'sentry.normalized_description',
        'sum(span.self_time)',
      ],
      sorts: [{field: 'sum(span.self_time)', kind: 'desc'}],
      search,
      limit: 3,
      noPagination: true,
    },
    Referrer.ASSETS_BY_TIME_SPENT
  );

  const timeSeriesRequest = useTopNSpanSeries(
    {
      search: `span.group:[${assetRequest.data?.map(item => `"${item['span.group']}"`).join(',')}]`,
      fields: ['span.group', 'sum(span.self_time)'],
      yAxis: ['sum(span.self_time)'],
      sort: {field: 'sum(span.self_time)', kind: 'desc'},
      topN: 3,
      enabled: assetRequest.data.length > 0,
    },
    Referrer.ASSETS_BY_TIME_SPENT
  );

  const timeSeries = timeSeriesRequest.data.filter(ts => ts.seriesName !== 'Other');

  const isLoading = timeSeriesRequest.isLoading || assetRequest.isLoading;
  const error = timeSeriesRequest.error || assetRequest.error;

  const hasData =
    assetRequest.data && assetRequest.data.length > 0 && timeSeries.length > 0;

  const colorPalette = theme.chart.getColorPalette(timeSeries.length - 1);

  const aliases: Record<string, string> = {};

  assetRequest.data?.forEach(asset => {
    aliases[asset['span.group']] = asset['sentry.normalized_description'];
  });

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={isLoading}
      error={error}
      emptyMessage={<TimeSpentInDatabaseWidgetEmptyStateWarning />}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        id: 'overviewSlowQueriesChartWidget',
        showLegend: props.loaderSource === 'releases-drawer' ? 'auto' : 'never',
        plottables: timeSeries.map(
          (ts, index) =>
            new Line(convertSeriesToTimeseries(ts), {
              color: colorPalette[index],
              alias: aliases[ts.seriesName],
            })
        ),
        ...props,
        ...releaseBubbleProps,
      }}
    />
  );

  const footer = hasData && (
    <WidgetFooterTable>
      {assetRequest.data?.map((item, index) => (
        <Fragment
          key={`${item['project.id']}-${item['span.group']}-${item['sentry.normalized_description']}`}
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
              projectId={Number(item['project.id'])}
              group={item['span.group']}
              description={item['sentry.normalized_description']}
              moduleName={ModuleName.RESOURCE}
            />
          </div>
          <span>{getDuration((item['sum(span.self_time)'] ?? 0) / 1000, 2, true)}</span>
        </Fragment>
      ))}
    </WidgetFooterTable>
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Assets by Time Spent')} />}
      Visualization={visualization}
      Actions={
        hasData && (
          <Widget.WidgetToolbar>
            <ChartActionDropdown
              chartType={ChartType.LINE}
              yAxes={['sum(span.self_time)']}
              groupBy={[SpanFields.NORMALIZED_DESCRIPTION]}
              title={t('Assets by Time Spent')}
              search={search}
              aliases={aliases}
              referrer={Referrer.ASSETS_BY_TIME_SPENT}
            />
          </Widget.WidgetToolbar>
        )
      }
      noFooterPadding
      Footer={props.loaderSource === 'releases-drawer' ? undefined : footer}
    />
  );
}

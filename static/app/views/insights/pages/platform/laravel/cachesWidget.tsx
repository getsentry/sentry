import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import useOrganization from 'sentry/utils/useOrganization';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useTopNSpanEAPSeries} from 'sentry/views/insights/common/queries/useTopNDiscoverSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {useReleaseBubbleProps} from 'sentry/views/insights/pages/platform/shared/getReleaseBubbleProps';
import {
  ModalChartContainer,
  ModalTableWrapper,
  SeriesColorIndicator,
  WidgetFooterTable,
} from 'sentry/views/insights/pages/platform/shared/styles';
import {Toolbar} from 'sentry/views/insights/pages/platform/shared/toolbar';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import {HighestCacheMissRateTransactionsWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

function isColumnNotFoundError(error: QueryError | null) {
  return error?.message === 'Column cache.hit was not found in metrics indexer';
}
export function CachesWidget() {
  const theme = useTheme();
  const organization = useOrganization();
  const {query} = useTransactionNameQuery();
  const releaseBubbleProps = useReleaseBubbleProps();
  const pageFilterChartParams = usePageFilterChartParams();

  const cachesRequest = useEAPSpans(
    {
      fields: ['transaction', 'project.id', 'cache_miss_rate()', 'count()'],
      sorts: [{field: 'cache_miss_rate()', kind: 'desc'}],
      search: `span.op:[cache.get_item,cache.get] ${query}`,
      limit: 4,
    },
    Referrer.CACHE_CHART
  );

  const timeSeriesRequest = useTopNSpanEAPSeries(
    {
      ...pageFilterChartParams,
      search:
        cachesRequest.data &&
        `transaction:[${cachesRequest.data
          .map(item => `"${item.transaction}"`)
          .join(', ')}]`,
      fields: ['transaction', 'cache_miss_rate()'],
      yAxis: ['cache_miss_rate()'],
      sort: {field: 'cache_miss_rate()', kind: 'desc'},
      topN: 4,
      enabled: !!cachesRequest.data,
    },
    Referrer.CACHE_CHART
  );

  const timeSeries = timeSeriesRequest.data.filter(ts => ts.seriesName !== 'Other');

  const isLoading = timeSeriesRequest.isLoading || cachesRequest.isLoading;
  // The BE returns an error if cache.hit is not found in the metrics indexer.
  // This is expected behavior, so we don't want to show an error but the empty state.
  const isValidCachesError = !isColumnNotFoundError(cachesRequest.error);
  const error =
    timeSeriesRequest.error || (isValidCachesError ? cachesRequest.error : null);

  const hasData =
    !isColumnNotFoundError(cachesRequest.error) &&
    cachesRequest.data &&
    cachesRequest.data.length > 0 &&
    timeSeries.length > 0;

  const colorPalette = theme.chart.getColorPalette(timeSeries.length - 2);

  const visualization = (
    <WidgetVisualizationStates
      isLoading={isLoading}
      error={error}
      isEmpty={!hasData}
      emptyMessage={<HighestCacheMissRateTransactionsWidgetEmptyStateWarning />}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        showLegend: 'never',
        plottables: timeSeries.map(
          (ts, index) =>
            new Line(convertSeriesToTimeseries(ts), {color: colorPalette[index]})
        ),
        ...releaseBubbleProps,
      }}
    />
  );

  const footer = hasData && (
    <WidgetFooterTable columns={4}>
      {cachesRequest.data?.map((item, index) => {
        const count = item['count()'];
        const cacheMissRate = item['cache_miss_rate()'];
        const missedCount = Math.floor(count * cacheMissRate);
        return (
          <Fragment key={item.transaction}>
            <div>
              <SeriesColorIndicator
                style={{
                  backgroundColor: colorPalette[index],
                }}
              />
            </div>
            <div>
              <Link
                to={
                  organization.features.includes('insights-addon-modules')
                    ? `/insights/backend/caches?project=${item['project.id']}&transaction=${item.transaction}`
                    : `/insights/backend/caches`
                }
              >
                {item.transaction}
              </Link>
            </div>
            <span>
              {formatAbbreviatedNumber(missedCount)} / {formatAbbreviatedNumber(count)}
            </span>
            <span>{(cacheMissRate * 100).toFixed(2)}%</span>
          </Fragment>
        );
      })}
    </WidgetFooterTable>
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Cache Miss Rates')} />}
      Visualization={visualization}
      Actions={
        hasData && (
          <Toolbar
            onOpenFullScreen={() => {
              openInsightChartModal({
                title: t('Cache Miss Rates'),
                children: (
                  <Fragment>
                    <ModalChartContainer>{visualization}</ModalChartContainer>
                    <ModalTableWrapper>{footer}</ModalTableWrapper>
                  </Fragment>
                ),
              });
            }}
          />
        )
      }
      noFooterPadding
      Footer={footer}
    />
  );
}

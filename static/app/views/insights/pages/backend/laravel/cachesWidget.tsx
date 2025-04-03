import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useApiQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {
  ModalChartContainer,
  ModalTableWrapper,
  SeriesColorIndicator,
  WidgetFooterTable,
} from 'sentry/views/insights/pages/backend/laravel/styles';
import {Toolbar} from 'sentry/views/insights/pages/backend/laravel/toolbar';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/backend/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/backend/laravel/widgetVisualizationStates';
import {HighestCacheMissRateTransactionsWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

function isCacheHitError(error: RequestError | null) {
  return (
    error?.responseJSON?.detail === 'Column cache.hit was not found in metrics indexer'
  );
}
export function CachesWidget({query}: {query?: string}) {
  const theme = useTheme();
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams();

  const cachesRequest = useApiQuery<{
    data: Array<{
      'cache_miss_rate()': number;
      'count()': number;
      'project.id': string;
      transaction: string;
    }>;
  }>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          field: ['transaction', 'project.id', 'cache_miss_rate()', 'count()'],
          query: `span.op:[cache.get_item,cache.get] ${query}`,
          sort: '-cache_miss_rate()',
          useRpc: 1,
          per_page: 4,
        },
      },
    ],
    {
      staleTime: 0,
      retry: (failureCount, error) => {
        if (isCacheHitError(error)) {
          return false;
        }
        return failureCount < 3;
      },
    }
  );

  const timeSeriesRequest = useApiQuery<MultiSeriesEventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          field: ['transaction', 'cache_miss_rate()'],
          yAxis: 'cache_miss_rate()',
          query:
            cachesRequest.data &&
            `transaction:[${cachesRequest.data.data
              .map(item => `"${item.transaction}"`)
              .join(', ')}]`,
          sort: '-cache_miss_rate()',
          useRpc: 1,
          topEvents: 4,
        },
      },
    ],
    {staleTime: 0}
  );

  const timeSeries = useMemo<DiscoverSeries[]>(() => {
    if (
      !timeSeriesRequest.data ||
      // There are no-data cases, for which the endpoint returns a single empty series with meta containing an explanation
      'data' in timeSeriesRequest.data
    ) {
      return [];
    }

    return Object.keys(timeSeriesRequest.data).map(key => {
      const seriesData = timeSeriesRequest.data[key]!;
      return {
        data: seriesData.data.map(([time, value]) => ({
          name: new Date(time * 1000).toISOString(),
          value: value?.[0]?.count || 0,
        })),
        // TODO(aknaus): useSpanMetricsTopNSeries does not return the meta for the series
        seriesName: key,
        meta: {
          fields: {
            [key]: seriesData.meta?.fields['cache_miss_rate()']!,
          },
          units: {
            [key]: seriesData.meta?.units['cache_miss_rate()']!,
          },
        },
      } satisfies DiscoverSeries;
    });
  }, [timeSeriesRequest.data]);

  const isLoading = timeSeriesRequest.isLoading || cachesRequest.isLoading;
  const isValidCachesError = !isCacheHitError(cachesRequest.error);
  const error =
    timeSeriesRequest.error || (isValidCachesError ? cachesRequest.error : null);

  const hasData =
    !isCacheHitError(cachesRequest.error) &&
    cachesRequest.data &&
    cachesRequest.data.data.length > 0 &&
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
      }}
    />
  );

  const footer = hasData && (
    <WidgetFooterTable columns={4}>
      {cachesRequest.data?.data.map((item, index) => {
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
                to={`/insights/backend/caches?project=${item['project.id']}&transaction=${item.transaction}`}
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

import {Fragment, useMemo} from 'react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import {getChartColorPalette} from 'sentry/constants/chartPalette';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import {MISSING_DATA_MESSAGE} from 'sentry/views/dashboards/widgets/common/settings';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {useSpanMetricsTopNSeries} from 'sentry/views/insights/common/queries/useSpanMetricsTopNSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {
  ModalChartContainer,
  ModalTableWrapper,
  SeriesColorIndicator,
  WidgetFooterTable,
} from 'sentry/views/insights/pages/backend/laravel/styles';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/backend/laravel/utils';

export function CachesWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams();

  const cachesRequest = useApiQuery<{
    data: Array<{
      'cache_miss_rate()': number;
      'project.id': string;
      transaction: string;
    }>;
  }>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spansMetrics',
          field: ['transaction', 'project.id', 'cache_miss_rate()'],
          query: `span.op:[cache.get_item,cache.get] ${query}`,
          sort: '-cache_miss_rate()',
          per_page: 4,
        },
      },
    ],
    {staleTime: 0}
  );

  const timeSeriesRequest = useSpanMetricsTopNSeries({
    search: new MutableSearch(
      // Cannot use transaction:[value1, value2] syntax as
      // MutableSearch might escape it to transactions:"[value1, value2]" for some values
      cachesRequest.data?.data
        .map(item => `transaction:"${item.transaction}"`)
        .join(' OR ') || ''
    ),
    fields: ['transaction', 'cache_miss_rate()'],
    yAxis: ['cache_miss_rate()'],
    sorts: [
      {
        field: 'cache_miss_rate()',
        kind: 'desc',
      },
    ],
    topEvents: 4,
    enabled: !!cachesRequest.data?.data,
  });

  const timeSeries = useMemo<DiscoverSeries[]>(() => {
    if (!timeSeriesRequest.data && timeSeriesRequest.meta) {
      return [];
    }

    return Object.keys(timeSeriesRequest.data).map(key => {
      const seriesData = timeSeriesRequest.data[key]!;
      return {
        ...seriesData,
        // TODO(aknaus): useSpanMetricsTopNSeries does not return the meta for the series
        meta: {
          fields: {
            [seriesData.seriesName]: 'percentage',
          },
          units: {
            [seriesData.seriesName]: '%',
          },
        },
      };
    });
  }, [timeSeriesRequest.data, timeSeriesRequest.meta]);

  const isLoading = timeSeriesRequest.isLoading || cachesRequest.isLoading;
  const error = timeSeriesRequest.error || cachesRequest.error;

  const hasData =
    cachesRequest.data && cachesRequest.data.data.length > 0 && timeSeries.length > 0;

  const colorPalette = getChartColorPalette(timeSeries.length - 2);

  const visualization = isLoading ? (
    <TimeSeriesWidgetVisualization.LoadingPlaceholder />
  ) : error ? (
    <Widget.WidgetError error={error} />
  ) : !hasData ? (
    <Widget.WidgetError error={MISSING_DATA_MESSAGE} />
  ) : (
    <TimeSeriesWidgetVisualization
      plottables={timeSeries
        .map(convertSeriesToTimeseries)
        .map((ts, index) => new Line(ts, {color: colorPalette[index]}))}
    />
  );

  const footer = hasData && (
    <WidgetFooterTable>
      {cachesRequest.data?.data.map((item, index) => (
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
          <span>{(item['cache_miss_rate()'] * 100).toFixed(2)}%</span>
        </Fragment>
      ))}
    </WidgetFooterTable>
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Cache Miss Rates')} />}
      Visualization={visualization}
      Actions={
        hasData && (
          <Widget.WidgetToolbar>
            <Button
              size="xs"
              aria-label={t('Open Full-Screen View')}
              borderless
              icon={<IconExpand />}
              onClick={() => {
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
          </Widget.WidgetToolbar>
        )
      }
      noFooterPadding
      Footer={footer}
    />
  );
}

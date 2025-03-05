import {Fragment, useMemo} from 'react';
import {Link} from 'react-router-dom';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import {MISSING_DATA_MESSAGE} from 'sentry/views/dashboards/widgets/common/settings';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {useSpanMetricsTopNSeries} from 'sentry/views/insights/common/queries/useSpanMetricsTopNSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
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

  return (
    <Widget
      Title={<Widget.WidgetTitle title="Caches" />}
      Visualization={
        isLoading ? (
          <TimeSeriesWidgetVisualization.LoadingPlaceholder />
        ) : error ? (
          <Widget.WidgetError error={error} />
        ) : !hasData ? (
          <Widget.WidgetError error={MISSING_DATA_MESSAGE} />
        ) : (
          <TimeSeriesWidgetVisualization
            visualizationType="line"
            timeSeries={timeSeries.map(convertSeriesToTimeseries)}
          />
        )
      }
      Footer={
        hasData && (
          <WidgetFooterTable>
            {cachesRequest.data?.data.map(item => (
              <Fragment key={item.transaction}>
                <OverflowCell>
                  <Link
                    to={`/insights/backend/caches?project=${item['project.id']}&transaction=${item.transaction}`}
                  >
                    {item.transaction}
                  </Link>
                </OverflowCell>
                <span>{(item['cache_miss_rate()'] * 100).toFixed(2)}%</span>
              </Fragment>
            ))}
          </WidgetFooterTable>
        )
      }
    />
  );
}

const OverflowCell = styled('div')`
  ${p => p.theme.overflowEllipsis};
  min-width: 0px;
`;

const WidgetFooterTable = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  margin: -${space(1)} -${space(2)};
  font-size: ${p => p.theme.fontSizeSmall};

  & > * {
    padding: ${space(1)} ${space(1)};
  }

  & > *:nth-child(2n + 1) {
    padding-left: ${space(2)};
  }

  & > *:nth-child(2n) {
    padding-right: ${space(2)};
  }

  & > *:not(:nth-last-child(-n + 2)) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

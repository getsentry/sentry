import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import {MISSING_DATA_MESSAGE} from 'sentry/views/dashboards/widgets/common/settings';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {SpanDescriptionCell} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import {TimeSpentCell} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {useSpanMetricsTopNSeries} from 'sentry/views/insights/common/queries/useSpanMetricsTopNSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/backend/laravel/utils';
import {ModuleName} from 'sentry/views/insights/types';

interface QueriesDiscoverQueryResponse {
  data: Array<{
    'avg(span.self_time)': number;
    'project.id': string;
    'span.description': string;
    'span.group': string;
    'span.op': string;
    'sum(span.self_time)': number;
    'time_spent_percentage()': number;
    transaction: string;
  }>;
}

export function QueriesWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams();

  const queriesRequest = useApiQuery<QueriesDiscoverQueryResponse>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spansMetrics',
          field: [
            'span.op',
            'span.group',
            'project.id',
            'span.description',
            'sum(span.self_time)',
            'avg(span.self_time)',
            'time_spent_percentage()',
            'transaction',
          ],
          query: `has:span.description span.module:db ${query}`,
          sort: '-time_spent_percentage()',
          per_page: 3,
        },
      },
    ],
    {staleTime: 0}
  );

  const timeSeriesRequest = useSpanMetricsTopNSeries({
    search: new MutableSearch(
      // Cannot use transaction:[value1, value2] syntax as
      // MutableSearch might escape it to transactions:"[value1, value2]" for some values
      queriesRequest.data?.data
        .map(item => `span.group:"${item['span.group']}"`)
        .join(' OR ') || ''
    ),
    fields: ['span.group', 'sum(span.self_time)'],
    yAxis: ['sum(span.self_time)'],
    sorts: [
      {
        field: 'sum(span.self_time)',
        kind: 'desc',
      },
    ],
    topEvents: 3,
    enabled: !!queriesRequest.data?.data,
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
            [seriesData.seriesName]: 'duration',
          },
          units: {
            [seriesData.seriesName]: 'millisecond',
          },
        },
      };
    });
  }, [timeSeriesRequest.data, timeSeriesRequest.meta]);

  const isLoading = timeSeriesRequest.isLoading || queriesRequest.isLoading;
  const error = timeSeriesRequest.error || queriesRequest.error;

  const hasData =
    queriesRequest.data && queriesRequest.data.data.length > 0 && timeSeries.length > 0;

  return (
    <Widget
      Title={<Widget.WidgetTitle title="Slow Queries" />}
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
            aliases={Object.fromEntries(
              queriesRequest.data?.data.map(item => [
                item['span.group'],
                item['span.description'],
              ]) ?? []
            )}
            timeSeries={timeSeries.map(convertSeriesToTimeseries)}
          />
        )
      }
      noFooterPadding
      Footer={
        hasData && (
          <WidgetFooterTable>
            {queriesRequest.data?.data.map(item => (
              <Fragment key={item['span.description']}>
                <OverflowCell>
                  <SpanDescriptionCell
                    projectId={Number(item['project.id'])}
                    group={item['span.group']}
                    description={item['span.description']}
                    moduleName={ModuleName.DB}
                  />
                  <ControllerText>{item.transaction}</ControllerText>
                </OverflowCell>
                <TimeSpentCell
                  percentage={item['time_spent_percentage()']}
                  total={item['sum(span.self_time)']}
                  op={item['span.op']}
                />
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

const ControllerText = styled('div')`
  ${p => p.theme.overflowEllipsis};
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1;
  min-width: 0px;
`;

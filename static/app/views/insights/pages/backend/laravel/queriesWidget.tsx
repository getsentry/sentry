import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import getDuration from 'sentry/utils/duration/getDuration';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {MISSING_DATA_MESSAGE} from 'sentry/views/dashboards/widgets/common/settings';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {SpanDescriptionCell} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/backend/laravel/utils';
import {ModuleName} from 'sentry/views/insights/types';

interface QueriesDiscoverQueryResponse {
  data: Array<{
    'project.id': string;
    'sentry.normalized_description': string;
    'span.group': string;
    'span.op': string;
    'sum(span.duration)': number;
    'time_spent_percentage()': number;
    transaction: string;
  }>;
}

export function QueriesWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans',
  });

  const queriesRequest = useApiQuery<QueriesDiscoverQueryResponse>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          field: [
            'span.op',
            'span.group',
            'project.id',
            'sentry.normalized_description',
            'sum(span.duration)',
            'transaction',
          ],
          query: `has:db.system !transaction.span_id:00 ${query}`,
          sort: '-sum(span.duration)',
          per_page: 3,
          useRpc: 1,
        },
      },
    ],
    {staleTime: 0}
  );

  const timeSeriesRequest = useApiQuery<MultiSeriesEventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          field: ['transaction', 'span.group', 'sum(span.duration)'],
          yAxis: ['sum(span.duration)'],
          query: `span.group:[${queriesRequest.data?.data.map(item => `"${item['span.group']}"`).join(',')}]`,
          sort: '-sum(span.duration)',
          topEvents: 3,
          useRpc: 1,
        },
      },
    ],
    {staleTime: 0}
  );

  const timeSeries = useMemo<DiscoverSeries[]>(() => {
    if (!timeSeriesRequest.data) {
      return [];
    }

    return Object.keys(timeSeriesRequest.data)
      .filter(key => key !== 'Other')
      .map(key => {
        const seriesData = timeSeriesRequest.data[key]!;
        return {
          data: seriesData.data.map(([time, value]) => ({
            name: new Date(time * 1000).toISOString(),
            value: value?.[0]?.count || 0,
          })),
          seriesName: key,
          meta: {
            fields: {
              [key]: 'duration',
            },
            units: {
              [key]: 'millisecond',
            },
          },
        } satisfies DiscoverSeries;
      });
  }, [timeSeriesRequest.data]);

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
            aliases={Object.fromEntries(
              queriesRequest.data?.data.map(item => [
                `${item.transaction},${item['span.group']}`,
                item['sentry.normalized_description'],
              ]) ?? []
            )}
            plottables={timeSeries.map(convertSeriesToTimeseries).map(ts => new Line(ts))}
          />
        )
      }
      noFooterPadding
      Footer={
        hasData && (
          <WidgetFooterTable>
            {queriesRequest.data?.data.map(item => (
              <Fragment key={item['sentry.normalized_description']}>
                <OverflowCell>
                  <SpanDescriptionCell
                    projectId={Number(item['project.id'])}
                    group={item['span.group']}
                    description={item['sentry.normalized_description']}
                    moduleName={ModuleName.DB}
                  />
                  <ControllerText>{item.transaction}</ControllerText>
                </OverflowCell>
                <span>
                  {getDuration((item['sum(span.duration)'] ?? 0) / 1000, 2, true)}
                </span>
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
    text-align: right;
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

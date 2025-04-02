import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import getDuration from 'sentry/utils/duration/getDuration';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {SpanDescriptionCell} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
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
import {ModuleName} from 'sentry/views/insights/types';
import {TimeSpentInDatabaseWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

interface QueriesDiscoverQueryResponse {
  data: Array<{
    'avg(span.duration)': number;
    'project.id': string;
    'sentry.normalized_description': string;
    'span.group': string;
    'span.op': string;
    'time_spent_percentage()': number;
    transaction: string;
  }>;
}

function getSeriesName(item: {'span.group': string; transaction: string}) {
  return `${item.transaction},${item['span.group']}`;
}

export function QueriesWidget({query}: {query?: string}) {
  const theme = useTheme();
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans',
  });

  const fullQuery = `has:db.system ${query}`;

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
            'avg(span.duration)',
            'transaction',
          ],
          query: fullQuery,
          sort: '-avg(span.duration)',
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
          field: ['transaction', 'span.group', 'avg(span.duration)'],
          yAxis: ['avg(span.duration)'],
          query: `span.group:[${queriesRequest.data?.data.map(item => `"${item['span.group']}"`).join(',')}]`,
          sort: '-avg(span.duration)',
          topEvents: 3,
          useRpc: 1,
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

  const colorPalette = theme.chart.getColorPalette(timeSeries.length - 2);

  const aliases = Object.fromEntries(
    queriesRequest.data?.data.map(item => [
      getSeriesName(item),
      item['sentry.normalized_description'],
    ]) ?? []
  );

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={isLoading}
      error={error}
      emptyMessage={<TimeSpentInDatabaseWidgetEmptyStateWarning />}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        showLegend: 'never',
        plottables: timeSeries.map(
          (ts, index) =>
            new Line(convertSeriesToTimeseries(ts), {
              color: colorPalette[index],
              alias: aliases[ts.seriesName],
            })
        ),
      }}
    />
  );

  const footer = hasData && (
    <WidgetFooterTable>
      {queriesRequest.data?.data.map((item, index) => (
        <Fragment key={item['sentry.normalized_description']}>
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
              moduleName={ModuleName.DB}
            />
            <ControllerText>{item.transaction}</ControllerText>
          </div>
          <span>{getDuration((item['avg(span.duration)'] ?? 0) / 1000, 2, true)}</span>
        </Fragment>
      ))}
    </WidgetFooterTable>
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Slow Queries')} />}
      Visualization={visualization}
      Actions={
        hasData && (
          <Toolbar
            exploreParams={{
              mode: Mode.AGGREGATE,
              visualize: [
                {
                  chartType: ChartType.LINE,
                  yAxes: ['avg(span.duration)'],
                },
              ],
              groupBy: ['sentry.normalized_description'],
              query: fullQuery,
              interval: pageFilterChartParams.interval,
            }}
            onOpenFullScreen={() => {
              openInsightChartModal({
                title: t('Slow Queries'),
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

const ControllerText = styled('div')`
  ${p => p.theme.overflowEllipsis};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1;
  min-width: 0px;
`;

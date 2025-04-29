import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import getDuration from 'sentry/utils/duration/getDuration';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {Release} from 'sentry/views/dashboards/widgets/common/types';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {
  ModalChartContainer,
  ModalTableWrapper,
  SeriesColorIndicator,
  WidgetFooterTable,
} from 'sentry/views/insights/pages/platform/laravel/styles';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {Toolbar} from 'sentry/views/insights/pages/platform/shared/toolbar';

function renameMeta(meta: EventsMetaType, from: string, to: string): EventsMetaType {
  return {
    fields: {
      [to]: meta.fields[from]!,
    },
    units: {
      [to]: meta.units[from]!,
    },
  };
}

export function SlowSSRWidget({query, releases}: {query?: string; releases?: Release[]}) {
  const theme = useTheme();
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans',
  });

  const fullQuery = `span.op:function.nextjs ${query}`;

  const spansRequest = useEAPSpans(
    {
      search: fullQuery,
      fields: ['span.group', 'project.id', 'span.description', 'avg(span.duration)'],
      sorts: [{field: 'avg(span.duration)', kind: 'desc'}],
      limit: 4,
    },
    Referrer.SLOW_SSR_CHART
  );

  const timeSeriesRequest = useApiQuery<MultiSeriesEventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          field: ['span.group', 'avg(span.duration)'],
          yAxis: ['avg(span.duration)'],
          query: `span.group:[${spansRequest.data?.map(item => `"${item['span.group']}"`).join(',')}]`,
          sort: '-avg(span.duration)',
          topEvents: 4,
          useRpc: 1,
          referrer: Referrer.SLOW_SSR_CHART,
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
          meta: renameMeta(seriesData.meta as EventsMetaType, 'avg(span.duration)', key),
        } satisfies DiscoverSeries;
      });
  }, [timeSeriesRequest.data]);

  const isLoading = timeSeriesRequest.isLoading || spansRequest.isLoading;
  const error = timeSeriesRequest.error || spansRequest.error;

  const hasData =
    spansRequest.data && spansRequest.data.length > 0 && timeSeries.length > 0;

  const colorPalette = theme.chart.getColorPalette(timeSeries.length - 2);

  const aliases = Object.fromEntries(
    spansRequest.data?.map(item => [item['span.group'], item['span.description']]) ?? []
  );

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={isLoading}
      error={error}
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
        releases,
        showReleaseAs: 'bubble',
      }}
    />
  );

  const footer = hasData && (
    <WidgetFooterTable>
      {spansRequest.data?.map((item, index) => (
        <Fragment key={item['span.description']}>
          <div>
            <SeriesColorIndicator
              style={{
                backgroundColor: colorPalette[index],
              }}
            />
          </div>
          <div>
            <Link
              to={getExploreUrl({
                mode: Mode.SAMPLES,
                visualize: [
                  {
                    chartType: ChartType.BAR,
                    yAxes: ['count(span.duration)'],
                  },
                ],
                sort: '-count(span.duration)',
                query: `${fullQuery} span.description:"${item['span.description']}"`,
                interval: pageFilterChartParams.interval,
                organization,
                selection,
              })}
            >
              {item['span.description']}
            </Link>
          </div>
          <span>{getDuration((item['avg(span.duration)'] ?? 0) / 1000, 2, true)}</span>
        </Fragment>
      ))}
    </WidgetFooterTable>
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Slow SSR')} />}
      Visualization={visualization}
      Actions={
        organization.features.includes('visibility-explore-view') &&
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
              groupBy: ['span.description'],
              query: fullQuery,
              interval: pageFilterChartParams.interval,
            }}
            onOpenFullScreen={() => {
              openInsightChartModal({
                title: t('Slow SSR'),
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

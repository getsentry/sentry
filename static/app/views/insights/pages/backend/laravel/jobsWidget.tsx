import {Fragment, useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {MISSING_DATA_MESSAGE} from 'sentry/views/dashboards/widgets/common/settings';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
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
import {usePageFilterChartParams} from 'sentry/views/insights/pages/backend/laravel/utils';

const seriesAliases = {
  ok: t('Processed'),
  internal_error: t('Failed'),
};

function createEmptySeries(color: string, seriesName: string): DiscoverSeries {
  return {
    data: [],
    seriesName,
    meta: {
      fields: {},
      units: {},
    },
    color,
  };
}

export function JobsWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans-low',
  });
  const theme = useTheme();

  const {data, isLoading, error} = useApiQuery<MultiSeriesEventsStats>(
    [
      `/organizations/${organization.slug}/events-stats/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          field: ['trace.status', 'count(span.duration)'],
          yAxis: ['count(span.duration)'],
          transformAliasToInputFormat: 1,
          query: `span.op:queue.process ${query}`.trim(),
          useRpc: 1,
          topEvents: 10,
        },
      },
    ],
    {staleTime: 0}
  );

  const statsToSeries = useCallback(
    (stats: EventsStats | undefined, name: string, color: string): DiscoverSeries => {
      if (!stats) {
        return createEmptySeries(color, name);
      }

      return {
        data: stats.data.map(([time], index) => ({
          name: new Date(time * 1000).toISOString(),
          value: stats.data[index]?.[1][0]?.count! || 0,
        })),
        seriesName: name,
        meta: {
          fields: {
            [name]: 'integer',
          },
          units: {
            [name]: '',
          },
        },
        color,
      };
    },
    []
  );

  const timeSeries = useMemo<DiscoverSeries[]>(() => {
    if (!data) {
      return [];
    }

    const okJobs = statsToSeries(data.ok, 'ok', theme.gray200);
    const failedJobs = statsToSeries(data.internal_error, 'internal_error', theme.error);
    return [okJobs, failedJobs].filter(series => !!series);
  }, [data, statsToSeries, theme.error, theme.gray200]);

  const hasData = timeSeries.length > 0;

  const footer = hasData && (
    <WidgetFooterTable>
      {timeSeries.map(series => {
        const total = series.data.reduce((sum, point) => sum + point.value, 0);
        return (
          <Fragment key={series.seriesName}>
            <div>
              <SeriesColorIndicator
                style={{
                  backgroundColor: series.color,
                }}
              />
            </div>
            <div>{seriesAliases[series.seriesName as keyof typeof seriesAliases]}</div>
            <span>{formatAbbreviatedNumber(total)}</span>
          </Fragment>
        );
      })}
    </WidgetFooterTable>
  );

  const visualization = isLoading ? (
    <TimeSeriesWidgetVisualization.LoadingPlaceholder />
  ) : error ? (
    <Widget.WidgetError error={error} />
  ) : !hasData ? (
    <Widget.WidgetError error={MISSING_DATA_MESSAGE} />
  ) : (
    <TimeSeriesWidgetVisualization
      aliases={seriesAliases}
      plottables={timeSeries.map(
        ts => new Bars(convertSeriesToTimeseries(ts), {color: ts.color, stack: 'stack'})
      )}
    />
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Jobs')} />}
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
                  title: t('Jobs'),
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

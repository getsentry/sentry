import {Alert} from '@sentry/scraps/alert';
import {Container, Flex} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {toPageFilters} from 'sentry/components/seer/markdown/embeds/components/queryEmbedParams';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useFetchEventsTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {useOrganization} from 'sentry/utils/useOrganization';
import {plottablesCanBeVisualized} from 'sentry/views/dashboards/widgets/plottablesCanBeVisualized';
import {formatTimeSeriesName} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesName';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

import {QUERY_EMBED_ROW_LIMIT} from './queryEmbedConstants';

interface QueryEmbedTimeSeriesProps {
  data: EmbedOutput<'spansQuery'>;
  dataset:
    | DiscoverDatasets.SPANS
    | DiscoverDatasets.OURLOGS
    | DiscoverDatasets.TRACEMETRICS;
  emptyMessage: string;
  hasTable: boolean;
  referrer: string;
  yAxes: string[];
  sort?: Sort;
}

export function QueryEmbedTimeSeries({
  data,
  dataset,
  emptyMessage,
  hasTable,
  referrer,
  sort,
  yAxes,
}: QueryEmbedTimeSeriesProps) {
  const organization = useOrganization();
  const unsupported =
    data.transformations?.some(pipeline => pipeline.length > 0) &&
    !organization.features.includes('explore-interpolation-and-smoothing');
  const groupBy = data.mode === 'aggregate' ? data.groupBy?.filter(Boolean) : undefined;
  const pageFilters = toPageFilters(data);
  const query = useFetchEventsTimeSeries(
    dataset,
    {
      enabled: !unsupported,
      yAxis: yAxes,
      transformations: data.transformations,
      interval: data.interval,
      query: data.query,
      pageFilters,
      groupBy: groupBy?.length ? groupBy : undefined,
      topEvents: groupBy?.length ? QUERY_EMBED_ROW_LIMIT : undefined,
      sort: groupBy?.length ? sort : undefined,
    },
    referrer
  );

  if (unsupported) {
    return (
      <Alert role="alert" variant="warning">
        {t('Chart transformations are not available for this organization')}
      </Alert>
    );
  }

  if (query.isPending) {
    return (
      <Flex align="center" height="220px" justify="center" width="100%">
        <LoadingIndicator />
      </Flex>
    );
  }

  if (query.isError) {
    return (
      <Alert role="alert" variant="danger">
        {t('Unable to load chart data')}
      </Alert>
    );
  }

  const plottables = (query.data?.timeSeries ?? []).map((series, index) => {
    const timeSeries = {
      ...series,
      requestedTransformations: data.transformations?.[index % yAxes.length] ?? [],
    };
    return new Line(timeSeries, {
      name: `seer-query-series-${index}`,
      alias: series.meta.isOther
        ? [t('Other'), ...timeSeries.requestedTransformations].join(' · ')
        : formatTimeSeriesName(timeSeries),
    });
  });

  if (!plottablesCanBeVisualized(plottables)) {
    return hasTable ? null : (
      <Alert role="alert" variant="muted">
        {emptyMessage}
      </Alert>
    );
  }

  return (
    <Container
      containerType="inline-size"
      data-test-id="seer-chart-content"
      height="220px"
      width="100%"
    >
      <TimeSeriesWidgetVisualization
        disableZoom
        pageFilters={pageFilters}
        plottables={plottables}
        showReleaseAs="none"
        truncateLegendMenuLabels
      />
    </Container>
  );
}

import {useMemo} from 'react';

import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {SpanFields} from 'sentry/views/insights/types';

import type {LlmCacheEvidenceData} from './types';
import {useCallSitePageFilters} from './useCallSitePageFilters';
import {buildCallSiteQuery, LLM_CACHE_REFERRER} from './utils';

// The canonical attribute names, which are also the ones the detector summed.
// Most SDKs write the deprecated aliases instead, but the resolver back-fills
// those onto these, so the chart plots the same data the finding was derived
// from rather than a subset of it.
const INPUT_TOKENS = `sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS})` as const;
const CACHE_READ_TOKENS =
  `sum(${SpanFields.GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS})` as const;
const CACHE_CREATION_TOKENS =
  `sum(${SpanFields.GEN_AI_USAGE_CACHE_CREATION_INPUT_TOKENS})` as const;

// A week of history either side of the detection window, so the reader can see
// what the call site looked like before it was flagged and after they ship.
const PADDING_DAYS = 7;

interface LlmCacheActivityChartProps {
  evidenceData: LlmCacheEvidenceData;
}

function findSeries(timeSeries: TimeSeries[] | undefined, yAxis: string) {
  return timeSeries?.find(series => series.yAxis === yAxis);
}

/**
 * Derive the uncached band by subtracting cache traffic from total input.
 *
 * Clamped at zero for the same reason the detector clamps it: some providers
 * report input tokens exclusive of the cached ones.
 */
function deriveUncachedSeries(
  input: TimeSeries | undefined,
  reads: TimeSeries | undefined,
  writes: TimeSeries | undefined
): TimeSeries | undefined {
  if (!input) {
    return undefined;
  }

  const readsByTimestamp = new Map(
    reads?.values.map(item => [item.timestamp, item.value])
  );
  const writesByTimestamp = new Map(
    writes?.values.map(item => [item.timestamp, item.value])
  );

  return {
    ...input,
    yAxis: 'uncached',
    values: input.values.map(item => ({
      ...item,
      value:
        item.value === null
          ? null
          : Math.max(
              item.value -
                (readsByTimestamp.get(item.timestamp) ?? 0) -
                (writesByTimestamp.get(item.timestamp) ?? 0),
              0
            ),
    })),
  };
}

interface ActivityPlotProps {
  hasError: boolean;
  isPending: boolean;
  plottables: Bars[];
}

function ActivityPlot({isPending, hasError, plottables}: ActivityPlotProps) {
  if (isPending) {
    return <TimeSeriesWidgetVisualization.LoadingPlaceholder />;
  }
  if (hasError) {
    return <Text variant="danger">{t('Unable to load cache activity')}</Text>;
  }
  // The visualization throws rather than renders when it has nothing to draw,
  // and every bucket comes back null once the call site stops reporting -- after
  // a rename, past retention, or once the fix ships. All ordinary here.
  if (plottables.every(plottable => plottable.isEmpty)) {
    return (
      <Text variant="muted">
        {t('No cache activity recorded for this call site in this period.')}
      </Text>
    );
  }
  return <TimeSeriesWidgetVisualization plottables={plottables} />;
}

/**
 * How the call site's input tokens were billed over time.
 *
 * This is the only part of the page that moves after the reader ships a fix,
 * which is why it is worth a live query rather than numbers frozen at
 * detection time.
 */
export function LlmCacheActivityChart({evidenceData}: LlmCacheActivityChartProps) {
  const pageFilters = useCallSitePageFilters(evidenceData, {padDays: PADDING_DAYS});
  const query = buildCallSiteQuery(evidenceData);
  const enabled = query !== null && pageFilters !== undefined;

  const {data, isPending, error} = useFetchSpanTimeSeries(
    {
      yAxis: [INPUT_TOKENS, CACHE_READ_TOKENS, CACHE_CREATION_TOKENS],
      query: query ?? undefined,
      pageFilters,
      enabled,
    },
    LLM_CACHE_REFERRER
  );

  const plottables = useMemo(() => {
    const reads = findSeries(data?.timeSeries, CACHE_READ_TOKENS);
    const writes = findSeries(data?.timeSeries, CACHE_CREATION_TOKENS);
    const uncached = deriveUncachedSeries(
      findSeries(data?.timeSeries, INPUT_TOKENS),
      reads,
      writes
    );

    return [
      uncached && new Bars(uncached, {alias: t('Uncached'), stack: 'tokens'}),
      writes && new Bars(writes, {alias: t('Cache writes'), stack: 'tokens'}),
      reads && new Bars(reads, {alias: t('Cache reads'), stack: 'tokens'}),
    ].filter(plottable => plottable !== undefined);
  }, [data]);

  if (!enabled) {
    return null;
  }

  return (
    <Stack gap="md">
      <Container height="190px">
        <ActivityPlot
          isPending={isPending}
          hasError={error !== null}
          plottables={plottables}
        />
      </Container>
      <Text size="sm" variant="muted">
        {t(
          'Live data for this call site. It may differ slightly from the numbers captured when this issue was detected.'
        )}
      </Text>
    </Stack>
  );
}

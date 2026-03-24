import {useCallback, useMemo, useState} from 'react';

import {Stack} from '@sentry/scraps/layout';

import type {Selection} from 'sentry/components/charts/useChartXRangeSelection';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useMetricsPanelAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {TraceSamplesTableColumns} from 'sentry/views/explore/metrics/constants';
import {useMetricAggregatesTable} from 'sentry/views/explore/metrics/hooks/useMetricAggregatesTable';
import {useMetricSamplesTable} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';
import {useMetricTimeseries} from 'sentry/views/explore/metrics/hooks/useMetricTimeseries';
import {useTableOrientationControl} from 'sentry/views/explore/metrics/hooks/useOrientationControl';
import {MetricsGraph} from 'sentry/views/explore/metrics/metricGraph';
import {MetricInfoTabs} from 'sentry/views/explore/metrics/metricInfoTabs';
import {SideBySideOrientation} from 'sentry/views/explore/metrics/metricPanel/sideBySideOrientation';
import {StackedOrientation} from 'sentry/views/explore/metrics/metricPanel/stackedOrientation';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {canUseMetricsUIRefresh} from 'sentry/views/explore/metrics/metricsFlags';
import {
  MetricsFrozenContextProvider,
  type TracePeriod,
} from 'sentry/views/explore/metrics/metricsFrozenContext';
import {
  getMetricTableColumnType,
  getTracePeriodFromSelection,
} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsMode,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';

const RESULT_LIMIT = 50;
const TWO_MINUTE_DELAY = 120;

interface MetricPanelProps {
  queryIndex: number;
  traceMetric: TraceMetric;
  selection?: [number, number];
  setSelection?: (selection: [number, number] | null) => void;
}

export function MetricPanel({
  traceMetric,
  queryIndex,
  selection: selectionRange,
  setSelection,
}: MetricPanelProps) {
  const organization = useOrganization();
  const {
    orientation,
    setOrientation: setUserPreferenceOrientation,
    canChangeOrientation,
  } = useTableOrientationControl();
  const [infoContentHidden, setInfoContentHidden] = useState(false);

  const selectedTableRange: Selection | null = useMemo(() => {
    if (!selectionRange) {
      return null;
    }
    return {panelId: 'url', range: selectionRange};
  }, [selectionRange]);

  const tableTracePeriod: TracePeriod | undefined = useMemo(() => {
    if (!selectedTableRange) {
      return undefined;
    }
    return getTracePeriodFromSelection(selectedTableRange);
  }, [selectedTableRange]);
  const {isMetricOptionsEmpty} = useMetricOptions({enabled: Boolean(traceMetric.name)});
  const {result: timeseriesResult} = useMetricTimeseries({
    traceMetric,
    enabled: Boolean(traceMetric.name) && !isMetricOptionsEmpty,
  });

  const columns = TraceSamplesTableColumns;
  const fields = columns.filter(c => getMetricTableColumnType(c) !== 'stat');

  const hasMetricsUIRefresh = canUseMetricsUIRefresh(organization);

  const metricSamplesTableResult = useMetricSamplesTable({
    disabled: !traceMetric?.name || isMetricOptionsEmpty,
    limit: RESULT_LIMIT,
    traceMetric,
    fields,
    ingestionDelaySeconds: TWO_MINUTE_DELAY,
  });

  const metricAggregatesTableResult = useMetricAggregatesTable({
    enabled: Boolean(traceMetric.name) && !isMetricOptionsEmpty,
    limit: RESULT_LIMIT,
    traceMetric,
  });

  const mode = useQueryParamsMode();
  const sortBys = useQueryParamsSortBys();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const [interval] = useChartInterval();
  const topEvents = useTopEvents();

  useMetricsPanelAnalytics({
    interval,
    isTopN: !!topEvents,
    metricAggregatesTableResult,
    metricSamplesTableResult,
    metricTimeseriesResult: timeseriesResult,
    mode,
    traceMetric,
    sortBys,
    aggregateSortBys,
    panelIndex: queryIndex,
  });

  const handleTableSelectionChange = useCallback(
    (selection: Selection | null, _tracePeriod?: TracePeriod) => {
      setSelection?.(selection ? selection.range : null);
    },
    [setSelection]
  );

  if (hasMetricsUIRefresh) {
    return (
      <Panel data-test-id="metric-panel">
        <PanelBody>
          <MetricsFrozenContextProvider traceIds={[]} tracePeriod={tableTracePeriod}>
            <Stack gap="sm">
              <MetricsGraph
                timeseriesResult={timeseriesResult}
                orientation={orientation}
                isMetricOptionsEmpty={isMetricOptionsEmpty}
                queryIndex={queryIndex}
                tableSelection={selectedTableRange}
                onTableSelectionChange={handleTableSelectionChange}
              />
              <MetricInfoTabs
                traceMetric={traceMetric}
                additionalActions={undefined}
                contentsHidden={infoContentHidden}
                orientation={orientation}
                isMetricOptionsEmpty={isMetricOptionsEmpty}
              />
            </Stack>
          </MetricsFrozenContextProvider>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel data-test-id="metric-panel">
      <PanelBody>
        {orientation === 'right' ? (
          <SideBySideOrientation
            timeseriesResult={timeseriesResult}
            traceMetric={traceMetric}
            setOrientation={setUserPreferenceOrientation}
            orientation={orientation}
            infoContentHidden={infoContentHidden}
            setInfoContentHidden={setInfoContentHidden}
            isMetricOptionsEmpty={isMetricOptionsEmpty}
          />
        ) : (
          <StackedOrientation
            timeseriesResult={timeseriesResult}
            traceMetric={traceMetric}
            setOrientation={setUserPreferenceOrientation}
            orientation={orientation}
            canChangeOrientation={canChangeOrientation}
            infoContentHidden={infoContentHidden}
            setInfoContentHidden={setInfoContentHidden}
            isMetricOptionsEmpty={isMetricOptionsEmpty}
          />
        )}
      </PanelBody>
    </Panel>
  );
}

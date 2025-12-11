import {useState} from 'react';

import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {useMetricsPanelAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {TraceSamplesTableColumns} from 'sentry/views/explore/metrics/constants';
import {useMetricAggregatesTable} from 'sentry/views/explore/metrics/hooks/useMetricAggregatesTable';
import {useMetricSamplesTable} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';
import {useMetricTimeseries} from 'sentry/views/explore/metrics/hooks/useMetricTimeseries';
import {useTableOrientationControl} from 'sentry/views/explore/metrics/hooks/useOrientationControl';
import {SideBySideOrientation} from 'sentry/views/explore/metrics/metricPanel/sideBySideOrientation';
import {StackedOrientation} from 'sentry/views/explore/metrics/metricPanel/stackedOrientation';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {getMetricTableColumnType} from 'sentry/views/explore/metrics/utils';
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
}

export function MetricPanel({traceMetric, queryIndex}: MetricPanelProps) {
  const {
    orientation,
    setOrientation: setUserPreferenceOrientation,
    canChangeOrientation,
  } = useTableOrientationControl();
  const [infoContentHidden, setInfoContentHidden] = useState(false);
  const {isMetricOptionsEmpty} = useMetricOptions({enabled: Boolean(traceMetric.name)});
  const {result: timeseriesResult} = useMetricTimeseries({
    traceMetric,
    enabled: Boolean(traceMetric.name) && !isMetricOptionsEmpty,
  });

  const columns = TraceSamplesTableColumns;
  const fields = columns.filter(c => getMetricTableColumnType(c) !== 'stat');

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

  return (
    <Panel data-test-id="metric-panel">
      <PanelBody>
        {orientation === 'right' ? (
          <SideBySideOrientation
            timeseriesResult={timeseriesResult}
            queryIndex={queryIndex}
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
            queryIndex={queryIndex}
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

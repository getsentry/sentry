import {useCallback} from 'react';

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
import {
  useTableOrientationControl,
  type TableOrientation,
} from 'sentry/views/explore/metrics/hooks/useOrientationControl';
import {SideBySideOrientation} from 'sentry/views/explore/metrics/metricPanel/sideBySideOrientation';
import {StackedOrientation} from 'sentry/views/explore/metrics/metricPanel/stackedOrientation';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  useMetricVisualize,
  useSetMetricVisualize,
} from 'sentry/views/explore/metrics/metricsQueryParams';
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
    canChangeOrientation,
    orientation,
    visible: infoContentVisible,
  } = useTableOrientationControl();
  const {isMetricOptionsEmpty} = useMetricOptions({enabled: Boolean(traceMetric.name)});
  const {result: timeseriesResult} = useMetricTimeseries({
    traceMetric,
    enabled: Boolean(traceMetric.name) && !isMetricOptionsEmpty,
  });

  const visualize = useMetricVisualize();
  const setVisualize = useSetMetricVisualize();

  const updateTableConfig = useCallback(
    ({
      visible,
      newOrientation,
    }: {
      newOrientation?: TableOrientation;
      visible?: boolean;
    }) => {
      setVisualize(
        visualize.replace({
          tableConfig: {
            visible: visible ?? visualize.tableConfig?.visible,
            orientation: newOrientation ?? visualize.tableConfig?.orientation,
          },
        })
      );
    },
    [setVisualize, visualize]
  );

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
    yAxis: traceMetric.name || '',
    sortBys,
    aggregateSortBys,
  });

  return (
    <Panel>
      <PanelBody>
        {orientation === 'right' ? (
          <SideBySideOrientation
            timeseriesResult={timeseriesResult}
            queryIndex={queryIndex}
            traceMetric={traceMetric}
            orientation={orientation}
            isMetricOptionsEmpty={isMetricOptionsEmpty}
            infoContentVisible={infoContentVisible}
            updateTableConfig={updateTableConfig}
          />
        ) : (
          <StackedOrientation
            timeseriesResult={timeseriesResult}
            queryIndex={queryIndex}
            traceMetric={traceMetric}
            orientation={orientation}
            canChangeOrientation={canChangeOrientation}
            isMetricOptionsEmpty={isMetricOptionsEmpty}
            infoContentVisible={infoContentVisible}
            updateTableConfig={updateTableConfig}
          />
        )}
      </PanelBody>
    </Panel>
  );
}

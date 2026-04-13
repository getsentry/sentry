import {useState} from 'react';

import {Container, Stack} from '@sentry/scraps/layout';

import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useMetricsPanelAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {
  getTraceSamplesTableFields,
  TraceSamplesTableColumns,
} from 'sentry/views/explore/metrics/constants';
import {useMetricAggregatesTable} from 'sentry/views/explore/metrics/hooks/useMetricAggregatesTable';
import {useMetricSamplesTable} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';
import {useMetricTimeseries} from 'sentry/views/explore/metrics/hooks/useMetricTimeseries';
import {useTableOrientationControl} from 'sentry/views/explore/metrics/hooks/useOrientationControl';
import {SideBySideOrientation} from 'sentry/views/explore/metrics/metricPanel/sideBySideOrientation';
import {StackedOrientation} from 'sentry/views/explore/metrics/metricPanel/stackedOrientation';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {canUseMetricsUIRefresh} from 'sentry/views/explore/metrics/metricsFlags';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MetricToolbar} from 'sentry/views/explore/metrics/metricToolbar';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsMode,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';

const RESULT_LIMIT = 50;
const TWO_MINUTE_DELAY = 120;

interface MetricPanelProps {
  queryIndex: number;
  queryLabel: string;
  traceMetric: TraceMetric;
  references?: Set<string>;
}

export function MetricPanel({
  traceMetric,
  queryIndex,
  queryLabel,
  references,
}: MetricPanelProps) {
  const organization = useOrganization();
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

  const hasMetricsUIRefresh = canUseMetricsUIRefresh(organization);
  const fields = getTraceSamplesTableFields(TraceSamplesTableColumns);

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
  const visualize = useMetricVisualize();

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

  if (hasMetricsUIRefresh) {
    return (
      <Panel data-test-id="metric-panel">
        <PanelBody>
          <Stack gap="sm">
            <Container paddingBottom={visualize.visible ? undefined : 'sm'}>
              <MetricToolbar
                traceMetric={traceMetric}
                queryLabel={queryLabel}
                references={references}
              />
            </Container>
            {visualize.visible ? (
              <SideBySideOrientation
                timeseriesResult={timeseriesResult}
                traceMetric={traceMetric}
                setOrientation={setUserPreferenceOrientation}
                orientation={orientation}
                infoContentHidden={infoContentHidden}
                setInfoContentHidden={setInfoContentHidden}
                isMetricOptionsEmpty={isMetricOptionsEmpty}
              />
            ) : null}
          </Stack>
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

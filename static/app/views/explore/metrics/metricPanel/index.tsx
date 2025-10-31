import {useState} from 'react';

import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {useMetricTimeseries} from 'sentry/views/explore/metrics/hooks/useMetricTimeseries';
import {useTableOrientationControl} from 'sentry/views/explore/metrics/hooks/useOrientationControl';
import {SideBySideOrientation} from 'sentry/views/explore/metrics/metricPanel/sideBySideOrientation';
import {StackedOrientation} from 'sentry/views/explore/metrics/metricPanel/stackedOrientation';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

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
  const {result: timeseriesResult} = useMetricTimeseries({
    traceMetric,
    enabled: Boolean(traceMetric.name),
  });

  return (
    <Panel>
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
          />
        )}
      </PanelBody>
    </Panel>
  );
}

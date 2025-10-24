import {useRef} from 'react';

import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import SplitPanel from 'sentry/components/splitPanel';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useMetricTimeseries} from 'sentry/views/explore/metrics/hooks/useMetricTimeseries';
import {MetricsGraph} from 'sentry/views/explore/metrics/metricGraph';
import MetricInfoTabs from 'sentry/views/explore/metrics/metricInfoTabs';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

interface MetricPanelProps {
  queryIndex: number;
  traceMetric: TraceMetric;
}

const MIN_LEFT_WIDTH = 400;
const MIN_RIGHT_WIDTH = 400;

export function MetricPanel({traceMetric, queryIndex}: MetricPanelProps) {
  const measureRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: measureRef});

  const {result: timeseriesResult} = useMetricTimeseries({traceMetric});

  const hasSize = width > 0;

  return (
    <Panel>
      <PanelBody>
        <div ref={measureRef}>
          {hasSize ? (
            <SplitPanel
              availableSize={width}
              left={{
                content: (
                  <MetricsGraph
                    timeseriesResult={timeseriesResult}
                    queryIndex={queryIndex}
                  />
                ),
                default: width * 0.65,
                min: MIN_LEFT_WIDTH,
                max: width - MIN_RIGHT_WIDTH,
              }}
              right={<MetricInfoTabs traceMetric={traceMetric} />}
            />
          ) : null}
        </div>
      </PanelBody>
    </Panel>
  );
}

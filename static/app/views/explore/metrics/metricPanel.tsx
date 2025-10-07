import {useRef} from 'react';

import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SplitPanel from 'sentry/components/splitPanel';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useResettableState} from 'sentry/utils/useResettableState';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {MetricsGraph} from 'sentry/views/explore/metrics/metricGraph';
import MetricInfoTabs from 'sentry/views/explore/metrics/metricInfoTabs';
import {MetricRow} from 'sentry/views/explore/metrics/metricRow';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {type TraceMetric} from 'sentry/views/explore/metrics/traceMetric';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface MetricPanelProps {
  traceMetric: TraceMetric;
}

const MIN_LEFT_WIDTH = 400;
const MIN_RIGHT_WIDTH = 400;

export function MetricPanel({traceMetric}: MetricPanelProps) {
  const visualize = useMetricVisualize();
  const measureRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: measureRef});
  const [interval] = useChartInterval();
  const [metricName, setMetricName] = useResettableState(() => '');

  const timeseriesResult = useSortedTimeSeries(
    {
      search: new MutableSearch(`metric_name:${metricName}`),
      yAxis: [visualize.yAxis],
      interval,
      fields: [],
      enabled: Boolean(metricName),
    },
    'api.explore.metrics-stats',
    DiscoverDatasets.TRACEMETRICS
  );

  const hasSize = width > 0;

  return (
    <Panel>
      <PanelHeader>
        <MetricRow
          traceMetric={traceMetric}
          metricName={metricName}
          setMetricName={setMetricName}
        />
      </PanelHeader>
      <PanelBody>
        <div ref={measureRef}>
          {hasSize ? (
            <SplitPanel
              availableSize={width}
              left={{
                content: <MetricsGraph timeseriesResult={timeseriesResult} />,
                default: width * 0.65,
                min: MIN_LEFT_WIDTH,
                max: width - MIN_RIGHT_WIDTH,
              }}
              right={<MetricInfoTabs />}
            />
          ) : null}
        </div>
      </PanelBody>
    </Panel>
  );
}

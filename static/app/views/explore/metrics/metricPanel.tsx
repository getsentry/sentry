import {useRef} from 'react';

import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SplitPanel from 'sentry/components/splitPanel';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {MetricsGraph} from 'sentry/views/explore/metrics/metricGraph';
import MetricInfoTabs from 'sentry/views/explore/metrics/metricInfoTabs';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricRow} from 'sentry/views/explore/metrics/metricRow';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {useQueryParamsGroupBys} from 'sentry/views/explore/queryParams/context';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface MetricPanelProps {
  traceMetric: TraceMetric;
}

const MIN_LEFT_WIDTH = 400;
const MIN_RIGHT_WIDTH = 400;

export function MetricPanel({traceMetric}: MetricPanelProps) {
  const visualize = useMetricVisualize();
  const groupBys = useQueryParamsGroupBys();
  const measureRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: measureRef});
  const [interval] = useChartInterval();
  const topEvents = useTopEvents();

  const timeseriesResult = useSortedTimeSeries(
    {
      search: new MutableSearch(`metric.name:${traceMetric.name}`),
      yAxis: [visualize.yAxis],
      interval,
      fields: [...groupBys],
      enabled: Boolean(traceMetric.name),
      topEvents,
    },
    'api.explore.metrics-stats',
    DiscoverDatasets.TRACEMETRICS
  );

  const hasSize = width > 0;

  return (
    <Panel>
      <PanelHeader>
        <MetricRow traceMetric={traceMetric} />
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

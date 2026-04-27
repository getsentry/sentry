import {t} from 'sentry/locale';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/nodeRuntimeMetrics/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {traceMetricField} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/traceMetricField';
import {SpanFields} from 'sentry/views/insights/types';

const INTERVAL = '5m';

const KPI_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'node-runtime-event-loop-utilization-kpi',
      title: t('Event Loop Utilization'),
      description: t(
        'Average fraction of time the Node.js event loop is active (0-100%) across the selected time range. High utilization means less capacity to handle new work and may indicate CPU-bound processing or blocking operations.'
      ),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          fields: [
            traceMetricField(
              'avg',
              'node.runtime.event_loop.utilization',
              'gauge',
              'none'
            ),
          ],
          aggregates: [
            traceMetricField(
              'avg',
              'node.runtime.event_loop.utilization',
              'gauge',
              'none'
            ),
          ],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    },
    {
      id: 'node-runtime-cpu-utilization-kpi',
      title: t('CPU Utilization'),
      description: t(
        'Average CPU usage across all cores over the selected time range. Values above 1.0 (100%) are possible on multi-core systems. Sustained high utilization may indicate compute-bound workloads or insufficient scaling.'
      ),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          fields: [
            traceMetricField('avg', 'node.runtime.cpu.utilization', 'gauge', 'none'),
          ],
          aggregates: [
            traceMetricField('avg', 'node.runtime.cpu.utilization', 'gauge', 'none'),
          ],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    },
    {
      id: 'node-runtime-process-uptime-kpi',
      title: t('Process Uptime'),
      description: t(
        'Total process uptime summed across instances. Sudden resets indicate process crashes or restarts. Useful for detecting instability and correlating with deployment events.'
      ),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          fields: [
            traceMetricField('sum', 'node.runtime.process.uptime', 'counter', 'second'),
          ],
          aggregates: [
            traceMetricField('sum', 'node.runtime.process.uptime', 'counter', 'second'),
          ],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    },
  ],
  0,
  {h: 1, minH: 1}
);

const MEMORY_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'node-runtime-memory-usage',
      title: t('Memory Usage'),
      description: t(
        'Resident Set Size (RSS, total memory footprint), V8 heap total (allocated), and heap used (in-use). Growing RSS without matching heap growth may indicate native memory leaks. Heap used approaching heap total triggers more frequent garbage collection.'
      ),
      displayType: DisplayType.AREA,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          fields: [
            traceMetricField('avg', 'node.runtime.mem.rss', 'gauge', 'byte'),
            traceMetricField('avg', 'node.runtime.mem.heap_total', 'gauge', 'byte'),
            traceMetricField('avg', 'node.runtime.mem.heap_used', 'gauge', 'byte'),
          ],
          aggregates: [
            traceMetricField('avg', 'node.runtime.mem.rss', 'gauge', 'byte'),
            traceMetricField('avg', 'node.runtime.mem.heap_total', 'gauge', 'byte'),
            traceMetricField('avg', 'node.runtime.mem.heap_used', 'gauge', 'byte'),
          ],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    },
  ],
  1
);

// Event loop delay tables list the worst observed p99/p50 samples across instances.
// Each row = one emitted sample identified by (server.address, timestamp). max() is
// a no-op over a single-row group, used only to satisfy the query DSL. This avoids
// cross-instance aggregation of pre-computed percentiles, which is statistically
// unsound.
const worstEventLoopDelayTable = (
  percentile: 'p50' | 'p99',
  title: string,
  description: string
): Widget => {
  const metricName = `node.runtime.event_loop.delay.${percentile}`;
  const field = traceMetricField('max', metricName, 'gauge', 'second');
  return {
    id: `node-runtime-event-loop-delay-${percentile}-samples`,
    title,
    description,
    displayType: DisplayType.TABLE,
    widgetType: WidgetType.TRACEMETRICS,
    interval: INTERVAL,
    limit: 10,
    queries: [
      {
        name: '',
        fields: ['server.address', 'timestamp', field],
        aggregates: [field],
        columns: ['server.address', 'timestamp'],
        conditions: '',
        orderby: `-${field}`,
        fieldAliases: [t('Server'), t('Timestamp'), t('%s Delay', percentile)],
      },
    ],
  };
};

const EVENT_LOOP_DELAY_TABLES = spaceWidgetsEquallyOnRow(
  [
    worstEventLoopDelayTable(
      'p99',
      t('Top 10 Worst p99 Samples'),
      t(
        "Ten highest observed p99 event loop delay samples. Each row is one instance's 30s-interval percentile from Node's `perf_hooks` histogram — a true per-instance measurement, not a cross-instance aggregate."
      )
    ),
    worstEventLoopDelayTable(
      'p50',
      t('Top 10 Worst p50 Samples'),
      t(
        "Ten highest observed p50 (median) event loop delay samples. High p50 suggests consistent blocking. Each row is one instance's 30s-interval percentile — a true per-instance measurement, not a cross-instance aggregate."
      )
    ),
  ],
  3
);

const CORRELATION_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'node-runtime-cpu-utilization-over-time',
      title: t('CPU Utilization Over Time'),
      description: t(
        'CPU utilization trend over time. Correlate spikes with deployments, traffic changes, or event loop delay increases to identify compute-bound bottlenecks.'
      ),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          fields: [
            traceMetricField('avg', 'node.runtime.cpu.utilization', 'gauge', 'none'),
          ],
          aggregates: [
            traceMetricField('avg', 'node.runtime.cpu.utilization', 'gauge', 'none'),
          ],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    },
    {
      id: 'node-runtime-http-request-duration',
      title: t('HTTP Request Duration'),
      description: t(
        'Server-side HTTP request latency (p50 and p95). Compare with event loop delay and CPU utilization to determine if slow responses are caused by runtime bottlenecks or application logic.'
      ),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          fields: [
            `p50(${SpanFields.SPAN_DURATION})`,
            `p95(${SpanFields.SPAN_DURATION})`,
          ],
          aggregates: [
            `p50(${SpanFields.SPAN_DURATION})`,
            `p95(${SpanFields.SPAN_DURATION})`,
          ],
          columns: [],
          conditions: `${SpanFields.SPAN_OP}:http.server`,
          orderby: '',
        },
      ],
    },
  ],
  5
);

const WIDGETS: Widget[] = [
  ...KPI_WIDGETS,
  ...MEMORY_WIDGETS,
  ...EVENT_LOOP_DELAY_TABLES,
  ...CORRELATION_WIDGETS,
];

export const NODE_RUNTIME_METRICS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  filters: {},
  projects: [],
  title: DASHBOARD_TITLE,
  widgets: WIDGETS,
  onboarding: {
    type: 'custom',
    componentId: 'node-runtime-metrics',
    requiredProjectFlags: ['firstTransactionEvent'],
  },
};

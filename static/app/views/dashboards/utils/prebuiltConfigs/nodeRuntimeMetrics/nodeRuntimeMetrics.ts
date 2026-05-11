import {t} from 'sentry/locale';
import {DurationUnit, SizeUnit} from 'sentry/utils/discover/fields';
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
            traceMetricField('avg', 'node.runtime.event_loop.utilization', 'gauge', null),
          ],
          aggregates: [
            traceMetricField('avg', 'node.runtime.event_loop.utilization', 'gauge', null),
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
            traceMetricField('avg', 'node.runtime.cpu.utilization', 'gauge', null),
          ],
          aggregates: [
            traceMetricField('avg', 'node.runtime.cpu.utilization', 'gauge', null),
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
            traceMetricField(
              'sum',
              'node.runtime.process.uptime',
              'counter',
              DurationUnit.SECOND
            ),
          ],
          aggregates: [
            traceMetricField(
              'sum',
              'node.runtime.process.uptime',
              'counter',
              DurationUnit.SECOND
            ),
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
            traceMetricField('avg', 'node.runtime.mem.rss', 'gauge', SizeUnit.BYTE),
            traceMetricField(
              'avg',
              'node.runtime.mem.heap_total',
              'gauge',
              SizeUnit.BYTE
            ),
            traceMetricField('avg', 'node.runtime.mem.heap_used', 'gauge', SizeUnit.BYTE),
          ],
          aggregates: [
            traceMetricField('avg', 'node.runtime.mem.rss', 'gauge', SizeUnit.BYTE),
            traceMetricField(
              'avg',
              'node.runtime.mem.heap_total',
              'gauge',
              SizeUnit.BYTE
            ),
            traceMetricField('avg', 'node.runtime.mem.heap_used', 'gauge', SizeUnit.BYTE),
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
            traceMetricField('avg', 'node.runtime.cpu.utilization', 'gauge', null),
          ],
          aggregates: [
            traceMetricField('avg', 'node.runtime.cpu.utilization', 'gauge', null),
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
  3
);

const WIDGETS: Widget[] = [...KPI_WIDGETS, ...MEMORY_WIDGETS, ...CORRELATION_WIDGETS];

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

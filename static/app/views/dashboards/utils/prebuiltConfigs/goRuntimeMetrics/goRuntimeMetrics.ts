import {t} from 'sentry/locale';
import {DurationUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  DASHBOARD_DESCRIPTION,
  DASHBOARD_TITLE,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/goRuntimeMetrics/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {traceMetricField} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/traceMetricField';

const INTERVAL = '5m';

const CPU_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'go-runtime-cpu-utilization',
      title: t('CPU Utilization'),
      description: t(
        "Average fraction of the Go runtime's available CPU time spent working rather than idling. Values are ratios: 1.0 means 100%. Compare with GC CPU usage and scheduler delay to investigate CPU pressure."
      ),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          fields: [traceMetricField('avg', 'go.runtime.cpu.utilization', 'gauge', null)],
          aggregates: [
            traceMetricField('avg', 'go.runtime.cpu.utilization', 'gauge', null),
          ],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    },
    {
      id: 'go-runtime-gc-cpu-fraction',
      title: t('GC CPU Usage'),
      description: t(
        'Average fraction of CPU time consumed by garbage collection. Values are ratios: 1.0 means 100%. Sustained increases can help explain CPU pressure, but average GC CPU usage can hide long pauses.'
      ),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          fields: [traceMetricField('avg', 'go.runtime.gc.cpu_fraction', 'gauge', null)],
          aggregates: [
            traceMetricField('avg', 'go.runtime.gc.cpu_fraction', 'gauge', null),
          ],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    },
  ],
  0
);

const MEMORY_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'go-runtime-memory-total',
      title: t('Runtime Memory'),
      description: t(
        'Average total memory held by the Go runtime. Compare with live heap memory to distinguish heap growth from growth elsewhere in the runtime. This is not process RSS, and growth alone does not prove a leak.'
      ),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          fields: [
            traceMetricField('avg', 'go.runtime.mem.total', 'gauge', SizeUnit.BYTE),
          ],
          aggregates: [
            traceMetricField('avg', 'go.runtime.mem.total', 'gauge', SizeUnit.BYTE),
          ],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    },
    {
      id: 'go-runtime-heap-live',
      title: t('Live Heap Memory'),
      description: t(
        'Average memory occupied by live heap objects. Compare with total runtime memory and GC CPU usage to investigate heap growth. High memory usage alone does not prove a leak.'
      ),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          fields: [
            traceMetricField('avg', 'go.runtime.mem.heap_live', 'gauge', SizeUnit.BYTE),
          ],
          aggregates: [
            traceMetricField('avg', 'go.runtime.mem.heap_live', 'gauge', SizeUnit.BYTE),
          ],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    },
  ],
  2
);

const SCHEDULER_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'go-runtime-goroutines',
      title: t('Goroutine Count'),
      description: t(
        'Average goroutine count across the selected samples. Increases can indicate growing concurrency or accumulating work. Compare with scheduler delay; a high count alone does not prove a goroutine leak.'
      ),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          fields: [traceMetricField('avg', 'go.runtime.goroutines', 'gauge', null)],
          aggregates: [traceMetricField('avg', 'go.runtime.goroutines', 'gauge', null)],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    },
    {
      id: 'go-runtime-scheduler-latency',
      title: t('Scheduler Delay (p99)'),
      description: t(
        'Maximum reported p99 wait for runnable goroutines to execute in each chart interval. This is the maximum of collected p99 gauges, not a fleet-wide p99. Compare with CPU utilization and goroutine count to investigate scheduling pressure.'
      ),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          fields: [
            traceMetricField(
              'max',
              'go.runtime.sched.latency.p99',
              'gauge',
              DurationUnit.SECOND
            ),
          ],
          aggregates: [
            traceMetricField(
              'max',
              'go.runtime.sched.latency.p99',
              'gauge',
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
  4
);

const OPTIONAL_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'go-runtime-memory-limit',
      title: t('Memory Limit (optional)'),
      description: t(
        'Average configured Go runtime memory limit. Compare with runtime memory and heap goal for memory pressure context. Collection is disabled by default; no data is sent when GOMEMLIMIT is unset or this metric is disabled.'
      ),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          fields: [
            traceMetricField('avg', 'go.runtime.mem.limit', 'gauge', SizeUnit.BYTE),
          ],
          aggregates: [
            traceMetricField('avg', 'go.runtime.mem.limit', 'gauge', SizeUnit.BYTE),
          ],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    },
    {
      id: 'go-runtime-heap-goal',
      title: t('Heap Goal (optional)'),
      description: t(
        'Average target heap size for garbage collection. Compare with live heap memory and the configured memory limit when available. Collection is disabled by default; this chart has no data until the metric is enabled and received.'
      ),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          fields: [
            traceMetricField('avg', 'go.runtime.mem.heap_goal', 'gauge', SizeUnit.BYTE),
          ],
          aggregates: [
            traceMetricField('avg', 'go.runtime.mem.heap_goal', 'gauge', SizeUnit.BYTE),
          ],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    },
    {
      id: 'go-runtime-gc-pause',
      title: t('GC Pause p99 (optional)'),
      description: t(
        'Maximum reported p99 GC stop-the-world pause duration in each chart interval, not a fleet-wide p99. Highlights long pauses that average GC CPU usage can hide. Collection is disabled by default; this chart has no data until samples arrive.'
      ),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          fields: [
            traceMetricField(
              'max',
              'go.runtime.gc.pause.p99',
              'gauge',
              DurationUnit.SECOND
            ),
          ],
          aggregates: [
            traceMetricField(
              'max',
              'go.runtime.gc.pause.p99',
              'gauge',
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
  6
);

export const GO_RUNTIME_METRICS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  filters: {},
  projects: [],
  title: DASHBOARD_TITLE,
  description: DASHBOARD_DESCRIPTION,
  widgets: [...CPU_WIDGETS, ...MEMORY_WIDGETS, ...SCHEDULER_WIDGETS, ...OPTIONAL_WIDGETS],
  onboarding: {
    type: 'custom',
    componentId: 'go-runtime-metrics',
    requiredProjectFlags: ['firstTransactionEvent'],
  },
};

import {t} from 'sentry/locale';
import {SizeUnit} from 'sentry/utils/discover/fields';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {
  PrebuiltDashboard,
  PrebuiltWidget,
} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  DASHBOARD_DESCRIPTION,
  DASHBOARD_TITLE,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/elixirRuntimeMetrics/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {traceMetricField} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/traceMetricField';
import {SpanFields} from 'sentry/views/insights/types';

const INTERVAL = '5m';

const SCHEDULER_UTILIZATION = traceMetricField(
  'avg',
  'elixir.runtime.scheduler.utilization',
  'gauge',
  'ratio'
);

function memoryField(type: string) {
  return traceMetricField('avg', `elixir.runtime.mem.${type}`, 'gauge', SizeUnit.BYTE);
}

function query(aggregates: string[], conditions = ''): WidgetQuery {
  return {
    name: '',
    fields: aggregates,
    aggregates,
    columns: [],
    conditions,
    orderby: '',
  };
}

const KPI_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'elixir-runtime-scheduler-utilization-kpi',
      title: t('Scheduler Utilization'),
      description: t(
        'Average fraction of time the BEAM schedulers spent doing work across the selected time range. Sustained high utilization means the VM is CPU-bound and has little headroom for bursts.'
      ),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [query([SCHEDULER_UTILIZATION])],
    },
    {
      id: 'elixir-runtime-process-utilization-kpi',
      title: t('Process Limit Usage'),
      description: t(
        'Highest share of the process limit in use by any node. When the limit is reached, spawning new processes fails.'
      ),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        query([
          traceMetricField('max', 'elixir.runtime.process.utilization', 'gauge', 'ratio'),
        ]),
      ],
    },
    {
      id: 'elixir-runtime-atom-utilization-kpi',
      title: t('Atom Limit Usage'),
      description: t(
        'Highest share of the atom table in use by any node. Atoms are never garbage collected, and the VM crashes when the table is full.'
      ),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        query([
          traceMetricField('max', 'elixir.runtime.atom.utilization', 'gauge', 'ratio'),
        ]),
      ],
    },
  ],
  0,
  {h: 1, minH: 1}
);

const MEMORY_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'elixir-runtime-memory-usage',
      title: t('Memory Usage'),
      description: t(
        'Memory allocated by the BEAM, split by type: processes (heaps and stacks), binaries, ETS tables, loaded code, and atoms. Steady growth in one type points at the source of a leak, such as large binaries held by long-lived processes.'
      ),
      displayType: DisplayType.AREA,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        query([
          memoryField('processes'),
          memoryField('binary'),
          memoryField('ets'),
          memoryField('code'),
          memoryField('atom'),
        ]),
      ],
    },
  ],
  1
);

const SCHEDULER_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'elixir-runtime-scheduler-utilization-over-time',
      title: t('Scheduler Utilization Over Time'),
      description: t(
        'Scheduler utilization trend over time. Correlate spikes with deployments, traffic changes, or run queue growth to find CPU-bound bottlenecks.'
      ),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [query([SCHEDULER_UTILIZATION])],
    },
    {
      id: 'elixir-runtime-run-queue',
      title: t('Run Queue Length'),
      description: t(
        'Processes waiting for a CPU or dirty I/O scheduler. A run queue that keeps growing means work arrives faster than the schedulers can process it.'
      ),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        query([
          traceMetricField('avg', 'elixir.runtime.run_queue.cpu', 'gauge', null),
          traceMetricField('avg', 'elixir.runtime.run_queue.io', 'gauge', null),
        ]),
      ],
    },
  ],
  3
);

const CORRELATION_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'elixir-runtime-process-count',
      title: t('Process Count'),
      description: t(
        'Average number of processes alive per node. A count that only goes up usually means processes are leaking, for example tasks or GenServers that are started but never stopped.'
      ),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        query([traceMetricField('avg', 'elixir.runtime.process.count', 'gauge', null)]),
      ],
    },
    {
      id: 'elixir-runtime-http-request-duration',
      title: t('HTTP Request Duration'),
      description: t(
        'Server-side HTTP request latency (p50 and p95). Compare with scheduler utilization and run queue length to tell runtime bottlenecks apart from slow application code.'
      ),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: INTERVAL,
      queries: [
        query(
          [`p50(${SpanFields.SPAN_DURATION})`, `p95(${SpanFields.SPAN_DURATION})`],
          `${SpanFields.SPAN_OP}:http.server`
        ),
      ],
    },
  ],
  5
);

const WIDGETS: PrebuiltWidget[] = [
  ...KPI_WIDGETS,
  ...MEMORY_WIDGETS,
  ...SCHEDULER_WIDGETS,
  ...CORRELATION_WIDGETS,
];

export const ELIXIR_RUNTIME_METRICS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  filters: {},
  projects: [],
  title: DASHBOARD_TITLE,
  description: DASHBOARD_DESCRIPTION,
  widgets: WIDGETS,
  onboarding: {
    type: 'custom',
    componentId: 'elixir-runtime-metrics',
    requiredProjectFlags: ['firstTransactionEvent'],
  },
};

import type {Measurement} from 'sentry/types/event';
import {MobileVital, WebVital} from 'sentry/utils/fields';

import type {BaseNode} from './traceTreeNode/baseNode';
import type {TraceTree} from './traceTree';

// cls is not included as it is a cumulative layout shift and not a single point in time
export const RENDERABLE_MEASUREMENTS = [
  WebVital.TTFB,
  WebVital.FCP,
  WebVital.LCP,
  MobileVital.TIME_TO_FULL_DISPLAY,
  MobileVital.TIME_TO_INITIAL_DISPLAY,
]
  .map(n => n.replace('measurements.', ''))
  .reduce<Record<string, boolean>>((acc, curr) => {
    acc[curr] = true;
    return acc;
  }, {});

export const TRACE_VIEW_WEB_VITALS: WebVital[] = [
  WebVital.LCP,
  WebVital.FCP,
  WebVital.INP,
  WebVital.CLS,
  WebVital.TTFB,
];

export const TRACE_VIEW_MOBILE_VITALS: MobileVital[] = [
  MobileVital.APP_START_COLD,
  MobileVital.APP_START_WARM,
  MobileVital.FRAMES_SLOW_RATE,
  MobileVital.FRAMES_FROZEN_RATE,
  MobileVital.STALL_LONGEST_TIME,
  MobileVital.TIME_TO_INITIAL_DISPLAY,
  MobileVital.TIME_TO_FULL_DISPLAY,
];

const WEB_VITALS_LOOKUP = new Set<string>(
  TRACE_VIEW_WEB_VITALS.map(n => n.replace('measurements.', ''))
);
const MOBILE_VITALS_LOOKUP = new Set<string>(
  TRACE_VIEW_MOBILE_VITALS.map(n => n.replace('measurements.', ''))
);

const COLLECTABLE_MEASUREMENTS = [
  ...TRACE_VIEW_WEB_VITALS,
  ...TRACE_VIEW_MOBILE_VITALS,
].map(n => n.replace('measurements.', ''));

const MEASUREMENT_ACRONYM_MAPPING = {
  [MobileVital.TIME_TO_FULL_DISPLAY.replace('measurements.', '')]: 'TTFD',
  [MobileVital.TIME_TO_INITIAL_DISPLAY.replace('measurements.', '')]: 'TTID',
};

const MEASUREMENT_THRESHOLDS = {
  [WebVital.TTFB.replace('measurements.', '')]: 600,
  [WebVital.FP.replace('measurements.', '')]: 3000,
  [WebVital.FCP.replace('measurements.', '')]: 3000,
  [WebVital.LCP.replace('measurements.', '')]: 4000,
  [MobileVital.TIME_TO_INITIAL_DISPLAY.replace('measurements.', '')]: 2000,
};

function traceMeasurementToTimestamp(
  start_timestamp: number,
  measurement: number,
  unit: string
) {
  if (unit === 'second') {
    return (start_timestamp + measurement) * 1e3;
  }
  if (unit === 'millisecond') {
    return start_timestamp + measurement;
  }
  if (unit === 'nanosecond') {
    return (start_timestamp + measurement) * 1e-6;
  }
  throw new TypeError(`Unsupported measurement unit', ${unit}`);
}

// Collects measurements from a trace node and adds them to the indicators stored on trace tree
export function collectTraceMeasurements(
  tree: TraceTree,
  node: BaseNode,
  start_timestamp: number,
  measurements: Record<string, Measurement> | undefined,
  vitals: Map<BaseNode, TraceTree.CollectedVital[]>,
  vital_types: Set<'web' | 'mobile'>
): TraceTree.Indicator[] {
  if (!measurements) {
    return [];
  }

  const indicators: TraceTree.Indicator[] = [];

  for (const collectableMeasurement of COLLECTABLE_MEASUREMENTS) {
    const measurement = measurements[collectableMeasurement];

    if (!measurement || typeof measurement.value !== 'number' || !measurement.value) {
      continue;
    }

    if (!vitals.has(node)) {
      vitals.set(node, []);
    }

    if (WEB_VITALS_LOOKUP.has(collectableMeasurement)) {
      vital_types.add('web');
    } else if (MOBILE_VITALS_LOOKUP.has(collectableMeasurement)) {
      vital_types.add('mobile');
    }

    const eapScoreKey = `score.ratio.${collectableMeasurement}`;
    const legacyScoreKey = `score.${collectableMeasurement}`;
    const legacyScoreWeightKey = `score.weight.${collectableMeasurement}`;
    const score = node.isEAPEvent
      ? measurements[eapScoreKey]?.value === undefined
        ? undefined
        : Math.round(measurements[eapScoreKey].value * 100)
      : measurements[legacyScoreKey]?.value !== undefined &&
          measurements[legacyScoreWeightKey]?.value !== undefined
        ? Math.round(
            (measurements[legacyScoreKey].value /
              measurements[legacyScoreWeightKey].value) *
              100
          )
        : undefined;

    vitals.get(node)!.push({
      key: collectableMeasurement,
      measurement,
      score,
    });

    if (!RENDERABLE_MEASUREMENTS[collectableMeasurement]) {
      continue;
    }

    const isStandalone = isStandaloneSpanMeasurementNode(node);
    const existingIndicatorIndex = tree.indicators.findIndex(
      indicator => indicator.type === collectableMeasurement
    );

    if (existingIndicatorIndex !== -1 && !isStandalone) {
      continue;
    }

    // Standalone spans should win over transaction-level measurements, but the
    // measurement value is still applied relative to the provided timeline origin.
    const timestamp = traceMeasurementToTimestamp(
      start_timestamp,
      measurement.value,
      measurement.unit ?? 'millisecond'
    );

    const indicator: TraceTree.Indicator = {
      start: timestamp,
      duration: 0,
      measurement,
      poor: MEASUREMENT_THRESHOLDS[collectableMeasurement]
        ? measurement.value > MEASUREMENT_THRESHOLDS[collectableMeasurement]
        : false,
      type: collectableMeasurement,
      label: (
        MEASUREMENT_ACRONYM_MAPPING[collectableMeasurement] ?? collectableMeasurement
      ).toUpperCase(),
      score,
    };

    if (existingIndicatorIndex === -1) {
      indicators.push(indicator);
    } else {
      tree.indicators[existingIndicatorIndex] = indicator;
    }
  }

  return indicators;
}

function isStandaloneSpanMeasurementNode(node: BaseNode): boolean {
  if (node.value && 'op' in node.value && node.value.op) {
    if (
      node.value.op.startsWith('ui.webvital.') ||
      node.value.op.startsWith('ui.interaction.')
    ) {
      return true;
    }
  }

  return false;
}

// Configures which span ops carry which vital. `stableKey` is the new span
// attribute name; `deprecatedKey` is the old key still used internally for
// indicator type, vitals map key, and acronym lookup. A single op may map to
// multiple configs (e.g. the generic `app.start` op can carry either the cold
// or warm attribute).
type SpanVitalConfig = {
  deprecatedKey: string;
  matchOps: readonly string[];
  stableKey: string;
  // When true, fall back to reading `deprecatedKey` from span attributes if
  // `stableKey` is absent. Used for vitals where positioning doesn't matter
  // (pills only) so either format on the span is acceptable.
  readDeprecatedFromSpan?: boolean;
};

export const SPAN_VITAL_CONFIGS: readonly SpanVitalConfig[] = [
  {
    matchOps: ['ui.load.initial_display'],
    stableKey: 'app.vitals.ttid.value',
    deprecatedKey: 'time_to_initial_display',
  },
  {
    matchOps: ['ui.load.full_display'],
    stableKey: 'app.vitals.ttfd.value',
    deprecatedKey: 'time_to_full_display',
  },
  {
    matchOps: ['app.start', 'app.start.cold'],
    stableKey: 'app.vitals.start.cold.value',
    deprecatedKey: 'app_start_cold',
    readDeprecatedFromSpan: true,
  },
  {
    matchOps: ['app.start', 'app.start.warm'],
    stableKey: 'app.vitals.start.warm.value',
    deprecatedKey: 'app_start_warm',
    readDeprecatedFromSpan: true,
  },
];

export const SPAN_VITAL_OPS = new Set(SPAN_VITAL_CONFIGS.flatMap(c => c.matchOps));

// Collects vitals from span data attributes for spans with specific ops.
// New mobile SDKs send these as span attributes instead of transaction-level
// measurements. TTID/TTFD produce indicator lines positioned at the span's end
// timestamp; app start vitals are pills-only (no line).
export function collectSpanBasedVitals(
  tree: TraceTree,
  node: BaseNode,
  vitals: Map<BaseNode, TraceTree.CollectedVital[]>,
  vital_types: Set<'web' | 'mobile'>
): TraceTree.Indicator[] {
  const op = node.op;
  if (!op) {
    return [];
  }

  const indicators: TraceTree.Indicator[] = [];

  for (const config of SPAN_VITAL_CONFIGS) {
    if (!config.matchOps.includes(op)) {
      continue;
    }

    // Backend returns the attribute under the clean key if registered as a
    // public alias, or under the bracketed `tags[<key>,number]` form when
    // queried via the untyped-tag fallback.
    // TODO: drop the `tags[...]` fallback once sentry-conventions registers
    // these as public aliases and the request in index.tsx uses clean names.
    let value =
      node.attributes?.[config.stableKey] ??
      node.attributes?.[`tags[${config.stableKey},number]`];
    if ((typeof value !== 'number' || !value) && config.readDeprecatedFromSpan) {
      value = node.attributes?.[config.deprecatedKey];
    }
    if (typeof value !== 'number' || !value) {
      continue;
    }

    const measurement: Measurement = {value, unit: 'millisecond'};

    if (!vitals.has(node)) {
      vitals.set(node, []);
    }
    vital_types.add('mobile');
    vitals.get(node)!.push({
      key: config.deprecatedKey,
      measurement,
      score: undefined,
    });

    if (!RENDERABLE_MEASUREMENTS[config.deprecatedKey]) {
      continue;
    }

    // Place the indicator at the span's end timestamp
    const spanEndTimestamp = node.space[0] + node.space[1];

    const existingIndicatorIndex = tree.indicators.findIndex(
      indicator => indicator.type === config.deprecatedKey
    );

    const indicator: TraceTree.Indicator = {
      start: spanEndTimestamp,
      duration: 0,
      measurement,
      poor: MEASUREMENT_THRESHOLDS[config.deprecatedKey]
        ? measurement.value > MEASUREMENT_THRESHOLDS[config.deprecatedKey]
        : false,
      type: config.deprecatedKey,
      label: (
        MEASUREMENT_ACRONYM_MAPPING[config.deprecatedKey] ?? config.deprecatedKey
      ).toUpperCase(),
      score: undefined,
    };

    if (existingIndicatorIndex === -1) {
      indicators.push(indicator);
    } else {
      tree.indicators[existingIndicatorIndex] = indicator;
    }
  }

  return indicators;
}

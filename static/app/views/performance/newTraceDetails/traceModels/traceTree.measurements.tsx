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
  .reduce(
    (acc, curr) => {
      acc[curr] = true;
      return acc;
    },
    {} as Record<string, boolean>
  );

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

    const hasSeenMeasurement = tree.indicators.some(
      indicator => indicator.type === collectableMeasurement
    );
    if (!RENDERABLE_MEASUREMENTS[collectableMeasurement] || hasSeenMeasurement) {
      continue;
    }

    // Standalone span measurements occur at the exact start timestamp of the span.
    // We pass in 0 as the measurement value to prevent applying any unnecessary offset.
    const timestamp = traceMeasurementToTimestamp(
      start_timestamp,
      isStandaloneSpanMeasurementNode(node) ? 0 : measurement.value,
      measurement.unit ?? 'millisecond'
    );

    indicators.push({
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
    });
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

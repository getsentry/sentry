import type {Measurement} from 'sentry/types/event';
import {MobileVital, WebVital} from 'sentry/utils/fields';
import {
  MOBILE_VITAL_DETAILS,
  WEB_VITAL_DETAILS,
} from 'sentry/utils/performance/vitals/constants';
import type {Vital} from 'sentry/utils/performance/vitals/types';

import type {TraceTree} from './traceTree';
import type {TraceTreeNode} from './traceTreeNode';
// cls is not included as it is a cumulative layout shift and not a single point in time

const RENDERABLE_MEASUREMENTS = [
  WebVital.TTFB,
  WebVital.FP,
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

const WEB_VITALS = [
  WebVital.TTFB,
  WebVital.FP,
  WebVital.FCP,
  WebVital.LCP,
  WebVital.CLS,
  WebVital.FID,
  WebVital.INP,
  WebVital.REQUEST_TIME,
].map(n => n.replace('measurements.', ''));

const MOBILE_VITALS = [
  MobileVital.APP_START_COLD,
  MobileVital.APP_START_WARM,
  MobileVital.TIME_TO_INITIAL_DISPLAY,
  MobileVital.TIME_TO_FULL_DISPLAY,
  MobileVital.FRAMES_TOTAL,
  MobileVital.FRAMES_SLOW,
  MobileVital.FRAMES_FROZEN,
  MobileVital.FRAMES_SLOW_RATE,
  MobileVital.FRAMES_FROZEN_RATE,
  MobileVital.STALL_COUNT,
  MobileVital.STALL_TOTAL_TIME,
  MobileVital.STALL_LONGEST_TIME,
  MobileVital.STALL_PERCENTAGE,
].map(n => n.replace('measurements.', ''));

const WEB_VITALS_LOOKUP = new Set<string>(WEB_VITALS);
const MOBILE_VITALS_LOOKUP = new Set<string>(MOBILE_VITALS);

const COLLECTABLE_MEASUREMENTS = [...WEB_VITALS, ...MOBILE_VITALS].map(n =>
  n.replace('measurements.', '')
);

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

export const TRACE_MEASUREMENT_LOOKUP: Record<string, Vital> = {};

for (const key in {...MOBILE_VITAL_DETAILS, ...WEB_VITAL_DETAILS}) {
  TRACE_MEASUREMENT_LOOKUP[key.replace('measurements.', '')] = {
    ...MOBILE_VITAL_DETAILS[key as keyof typeof MOBILE_VITAL_DETAILS],
    ...WEB_VITAL_DETAILS[key as keyof typeof WEB_VITAL_DETAILS],
  };
}

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
  node: TraceTreeNode<TraceTree.NodeValue>,
  start_timestamp: number,
  measurements: Record<string, Measurement> | undefined,
  vitals: Map<TraceTreeNode<TraceTree.NodeValue>, TraceTree.CollectedVital[]>,
  vital_types: Set<'web' | 'mobile'>
): TraceTree.Indicator[] {
  const indicators: TraceTree.Indicator[] = [];

  if (!measurements) {
    return indicators;
  }

  for (const measurement of COLLECTABLE_MEASUREMENTS) {
    const value = measurements[measurement];

    if (!value || typeof value.value !== 'number') {
      continue;
    }

    if (!vitals.has(node)) {
      vitals.set(node, []);
    }

    WEB_VITALS_LOOKUP.has(measurement) && vital_types.add('web');
    MOBILE_VITALS_LOOKUP.has(measurement) && vital_types.add('mobile');

    const score = Math.round(
      (measurements[`score.${measurement}`]?.value /
        measurements[`score.weight.${measurement}`]?.value) *
        100
    );

    const vital = vitals.get(node)!;
    vital.push({
      key: measurement,
      measurement: value,
      score,
    });

    if (!RENDERABLE_MEASUREMENTS[measurement]) {
      continue;
    }

    const timestamp = traceMeasurementToTimestamp(
      start_timestamp,
      value.value,
      value.unit ?? 'millisecond'
    );

    const indicator: TraceTree.Indicator = {
      start: timestamp,
      duration: 0,
      measurement: value,
      poor: MEASUREMENT_THRESHOLDS[measurement]
        ? value.value > MEASUREMENT_THRESHOLDS[measurement]
        : false,
      type: measurement as TraceTree.Indicator['type'],
      label: (MEASUREMENT_ACRONYM_MAPPING[measurement] ?? measurement).toUpperCase(),
      score,
    };

    indicators.push(indicator);
  }

  return indicators;
}

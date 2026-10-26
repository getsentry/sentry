import type {Theme} from '@emotion/react';
import moment from 'moment-timezone';

import {lightenBarColor} from 'sentry/components/performance/waterfall/utils';

import type {GapSpanType, ProcessedSpanType, RawSpanType} from './types';

enum SpanSubTimingMark {
  SPAN_START = 0,
  SPAN_END = 1,
  HTTP_REQUEST_START = 'http.request.request_start',
  HTTP_RESPONSE_START = 'http.request.response_start',
}

export enum SpanSubTimingName {
  WAIT_TIME = 'Wait Time',
  REQUEST_TIME = 'Request Time',
  RESPONSE_TIME = 'Response Time',
}

// start and end are assumed to be unix timestamps with fractional seconds
export function getTraceDateTimeRange(input: {end: number; start: number}): {
  end: string;
  start: string;
} {
  const start = moment
    .unix(input.start)
    .subtract(12, 'hours')
    .utc()
    .format('YYYY-MM-DDTHH:mm:ss.SSS');

  const end = moment
    .unix(input.end)
    .add(12, 'hours')
    .utc()
    .format('YYYY-MM-DDTHH:mm:ss.SSS');

  return {
    start,
    end,
  };
}

function isGapSpan(span: ProcessedSpanType): span is GapSpanType {
  if ('type' in span) {
    return span.type === 'gap';
  }

  return false;
}

function getSpanOperation(span: ProcessedSpanType): string | undefined {
  if (isGapSpan(span)) {
    return undefined;
  }

  return span.op;
}

interface SubTimingDefinition {
  colorLighten: number;
  endMark: SpanSubTimingMark;
  name: string;
  startMark: SpanSubTimingMark;
}

export interface SubTimingInfo extends SubTimingDefinition {
  color: string;
  duration: number;
  endTimestamp: number;
  startTimestamp: number;
}

const SPAN_SUB_TIMINGS: Record<string, SubTimingDefinition[]> = {
  'http.client': [
    {
      startMark: SpanSubTimingMark.SPAN_START,
      endMark: SpanSubTimingMark.HTTP_REQUEST_START,
      name: SpanSubTimingName.WAIT_TIME,
      colorLighten: 0.5,
    },
    {
      startMark: SpanSubTimingMark.HTTP_REQUEST_START,
      endMark: SpanSubTimingMark.HTTP_RESPONSE_START,
      name: SpanSubTimingName.REQUEST_TIME,
      colorLighten: 0.25,
    },
    {
      startMark: SpanSubTimingMark.HTTP_RESPONSE_START,
      endMark: SpanSubTimingMark.SPAN_END,
      name: SpanSubTimingName.RESPONSE_TIME,
      colorLighten: 0,
    },
  ],
};

function subTimingMarkToTime(span: RawSpanType, mark: SpanSubTimingMark) {
  if (mark === SpanSubTimingMark.SPAN_START) {
    return span.start_timestamp;
  }
  if (mark === SpanSubTimingMark.SPAN_END) {
    return span.timestamp;
  }

  return (span as any).data?.[mark] as number | undefined;
}

export function getSpanSubTimings(
  span: ProcessedSpanType,
  theme: Theme
): SubTimingInfo[] | null {
  if (span.type) {
    return null; // narrow to RawSpanType
  }
  const op = getSpanOperation(span);
  if (!op) {
    return null;
  }
  const timingDefinitions = SPAN_SUB_TIMINGS[op];
  if (!timingDefinitions) {
    return null;
  }

  const timings: SubTimingInfo[] = [];
  const spanStart = subTimingMarkToTime(span, SpanSubTimingMark.SPAN_START);
  const spanEnd = subTimingMarkToTime(span, SpanSubTimingMark.SPAN_END);

  const TEN_MS = 0.001;

  for (const def of timingDefinitions) {
    const start = subTimingMarkToTime(span, def.startMark);
    const end = subTimingMarkToTime(span, def.endMark);
    if (
      !start ||
      !end ||
      !spanStart ||
      !spanEnd ||
      start < spanStart - TEN_MS ||
      end > spanEnd + TEN_MS
    ) {
      return null;
    }
    timings.push({
      ...def,
      duration: end - start,
      startTimestamp: start,
      endTimestamp: end,
      color: lightenBarColor(getSpanOperation(span), def.colorLighten, theme),
    });
  }

  return timings;
}

export function isBrowserJavaScriptSDKName(sdkName: string | null | undefined): boolean {
  if (!sdkName) {
    return false;
  }
  // based on https://github.com/getsentry/sentry-javascript/blob/master/packages/browser/src/version.ts
  return [
    'sentry.javascript.browser',
    'sentry.javascript.react',
    'sentry.javascript.gatsby',
    'sentry.javascript.ember',
    'sentry.javascript.vue',
    'sentry.javascript.angular',
    'sentry.javascript.angular-ivy',
    'sentry.javascript.nextjs',
    'sentry.javascript.electron',
    'sentry.javascript.remix',
    'sentry.javascript.svelte',
    'sentry.javascript.sveltekit',
    'sentry.javascript.astro',
  ].includes(sdkName.toLowerCase());
}

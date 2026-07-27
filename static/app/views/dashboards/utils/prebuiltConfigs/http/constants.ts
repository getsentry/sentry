import {SpanFields} from 'sentry/views/insights/types';

export const PERCENTAGE_3XX = `equation|count_if(\`${SpanFields.SPAN_STATUS_CODE}:>=300 AND ${SpanFields.SPAN_STATUS_CODE}:<=399\`) / count(${SpanFields.SPAN_DURATION})`;
export const PERCENTAGE_4XX = `equation|count_if(\`${SpanFields.SPAN_STATUS_CODE}:>=400 AND ${SpanFields.SPAN_STATUS_CODE}:<=499\`) / count(${SpanFields.SPAN_DURATION})`;
export const PERCENTAGE_5XX = `equation|count_if(\`${SpanFields.SPAN_STATUS_CODE}:>=500 AND ${SpanFields.SPAN_STATUS_CODE}:<=599\`) / count(${SpanFields.SPAN_DURATION})`;

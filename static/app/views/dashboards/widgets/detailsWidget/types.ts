import type {SpanFields} from 'sentry/views/insights/types';

export type DefaultDetailWidgetFields =
  | SpanFields.SPAN_OP
  | SpanFields.SPAN_GROUP
  | SpanFields.SPAN_DESCRIPTION
  | SpanFields.SPAN_ID
  | SpanFields.SPAN_CATEGORY;

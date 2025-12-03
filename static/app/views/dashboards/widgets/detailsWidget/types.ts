import type {SpanFields} from 'sentry/views/insights/types';

export type DefaultDetailWidgetFields =
  | SpanFields.SPAN_OP
  | SpanFields.SPAN_GROUP
  | SpanFields.SPAN_DESCRIPTION
  | SpanFields.ID
  | SpanFields.SPAN_CATEGORY;

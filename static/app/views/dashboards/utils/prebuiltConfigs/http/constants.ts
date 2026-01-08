import {SpanFields} from 'sentry/views/insights/types';

export const PERCENTAGE_3XX = `equation|count_if(${SpanFields.SPAN_STATUS_CODE},between,300,399) / count(${SpanFields.SPAN_DURATION})`;
export const PERCENTAGE_4XX = `equation|count_if(${SpanFields.SPAN_STATUS_CODE},between,400,499) / count(${SpanFields.SPAN_DURATION})`;
export const PERCENTAGE_5XX = `equation|count_if(${SpanFields.SPAN_STATUS_CODE},between,500,599) / count(${SpanFields.SPAN_DURATION})`;

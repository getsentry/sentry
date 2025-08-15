import type {TabularData} from 'sentry/views/dashboards/widgets/common/types';

export const sampleHTTPRequestTableData: TabularData = {
  data: [
    {
      'http.request_method': 'PATCH',
      'count(span.duration)': 14105,
      id: '',
    },
    {
      'http.request_method': 'HEAD',
      'count(span.duration)': 9494,
      id: '',
    },
    {
      'http.request_method': 'GET',
      'count(span.duration)': 38583495,
      id: '',
    },
    {
      'http.request_method': 'DELETE',
      'count(span.duration)': 123,
      id: '',
    },
    {
      'http.request_method': 'POST',
      'count(span.duration)': 21313,
      id: '',
    },
  ],
  meta: {
    fields: {
      'http.request_method': 'string',
      'count(span.duration)': 'integer',
    },
    units: {
      'http.request_method': null,
      'count(span.duration)': null,
    },
  },
};

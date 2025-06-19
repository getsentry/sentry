import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {TableColumn} from 'sentry/views/discover/table/types';

export const SAMPLE_TABLE_COLUMNS: Array<TableColumn<string>> = [
  {
    key: 'http.request_method',
    name: 'http.request_method',
    type: 'never',
    isSortable: false,
    column: {
      kind: 'field',
      field: 'http.request_method',
      alias: '',
    },
    width: -1,
  },
  {
    key: 'count(span.duration)',
    name: 'count(span.duration)',
    type: 'number',
    isSortable: true,
    column: {
      kind: 'function',
      function: ['count', 'span.duration', undefined, undefined],
      alias: '',
    },
    width: -1,
  },
];

export const SAMPLE_TABLE_DATA: TableData = {
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
    'http.request_method': 'string',
    'count(span.duration)': 'integer',
    units: {
      'http.request_method': '',
      'count(span.duration)': '',
    },
    isMetricsData: false,
    isMetricsExtractedData: false,
    datasetReason: 'unchanged',
    dataset: 'spans',
    dataScanned: 'partial',
    accuracy: {
      confidence: [
        {
          'count(span.duration)': 'high',
        },
        {
          'count(span.duration)': 'low',
        },
        {
          'count(span.duration)': 'high',
        },
        {
          'count(span.duration)': 'high',
        },
        {
          'count(span.duration)': 'high',
        },
      ],
    },
    fields: {
      'http.request_method': 'string',
      'count(span.duration)': 'integer',
    },
  },
};

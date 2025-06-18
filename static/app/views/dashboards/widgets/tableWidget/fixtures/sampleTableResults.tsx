import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';

export const SAMPLE_EVENT_VIEW = new EventView({
  id: undefined,
  name: undefined,
  fields: [
    {
      field: 'http.request_method',
      width: -1,
    },
    {
      field: 'count(span.duration)',
      width: -1,
    },
  ],
  sorts: [
    {
      kind: 'desc',
      field: 'http.request_method',
    },
  ],
  query: '',
  team: [],
  project: [],
  statsPeriod: undefined,
  environment: [],
  createdBy: undefined,
  yAxis: undefined,
  start: undefined,
  end: undefined,
  display: undefined,
  topEvents: undefined,
});

export const SAMPLE_TABLE_RESULTS: TableDataWithTitle[] = [
  {
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
    title: '',
  },
];

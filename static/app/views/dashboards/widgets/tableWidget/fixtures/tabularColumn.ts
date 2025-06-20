import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';

export function TabularColumnFixture(): TabularColumn[] {
  return [
    {
      key: 'count(span.duration)',
      name: 'count span.duration',
      type: 'number',
    },
    {
      key: 'http.request_method',
      name: 'http request_method',
      type: 'string',
    },
  ];
}

import type {WidgetQuery} from 'sentry/views/dashboards/types';

export function WidgetQueryFixture(params: Partial<WidgetQuery> = {}): WidgetQuery {
  return {
    name: '',
    fields: ['title', 'count()', 'count_unique(user)', 'epm()', 'count()'],
    columns: ['title'],
    aggregates: ['count()', 'count_unique(user)', 'epm()', 'count()'],
    conditions: 'tag:value',
    orderby: '',
    ...params,
  };
}

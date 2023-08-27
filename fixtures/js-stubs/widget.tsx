import type {
  Widget as TWidget,
  WidgetQuery as TWidgetQuery,
} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';

// const DEFAULT_QUERIES: TWidgetQuery[] = {
//   discover: [
//     {
//       name: 'Known Users',
//       fields: [],
//       columns: [],
//       aggregates: ['count()'],
//       conditions: [['user.email', 'IS NOT NULL', null]],
//       aggregations: [['uniq', 'user.email', 'Known Users']],
//       limit: 1000,

//       orderby: '-time',
//       groupby: ['time'],
//       rollup: 86400,
//     },
//     {
//       name: 'Anonymous Users',
//       fields: [],
//       columns: [],
//       aggregates: ['count()'],
//       conditions: [['user.email', 'IS NULL', null]],
//       aggregations: [['count()', null, 'Anonymous Users']],
//       limit: 1000,

//       orderby: '-time',
//       groupby: ['time'],
//       rollup: 86400,
//     },
//   ],
// };

export function Widget(queries: TWidgetQuery[], options: Partial<TWidget>): TWidget {
  return {
    displayType: DisplayType.LINE,
    interval: '1d',
    queries,
    title: 'Widget',
    ...options,
  };
}

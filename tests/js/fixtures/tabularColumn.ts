import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';

export function TabularColumnFixture(params: Partial<TabularColumn>): TabularColumn {
  return {
    key: 'column_key',
    name: 'column_name',
    type: 'string',
    width: -1,
    ...params,
  };
}

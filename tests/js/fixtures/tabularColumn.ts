import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';

export function TabularColumnFixture(params: Partial<TabularColumn>): TabularColumn {
  return {
    key: 'column_key',
    type: 'string',
    width: -1,
    ...params,
  };
}

import {TabularColumnFixture} from 'sentry-fixture/tabularColumn';

import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';

export function TabularColumnsFixture(
  params: Array<Partial<TabularColumn>>
): TabularColumn[] {
  return params.map((param: Partial<TabularColumn>) => TabularColumnFixture(param));
}

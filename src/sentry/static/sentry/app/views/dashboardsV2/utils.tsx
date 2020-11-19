import cloneDeep from 'lodash/cloneDeep';

import {DashboardListItem} from './types';

export function cloneDashboard(dashboard: DashboardListItem): DashboardListItem {
  return cloneDeep(dashboard);
}

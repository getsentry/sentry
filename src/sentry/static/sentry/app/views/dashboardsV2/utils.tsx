import cloneDeep from 'lodash/cloneDeep';

import {DashboardDetails} from './types';

export function cloneDashboard(dashboard: DashboardDetails): DashboardDetails {
  return cloneDeep(dashboard);
}

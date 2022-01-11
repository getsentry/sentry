import {Layout} from 'react-grid-layout';

import localStorage from 'sentry/utils/localStorage';

import {constructGridItemKey} from '../dashboard';
import {Widget} from '../types';

const getLocalStorageKey = (organizationId: string, dashboardId: string) =>
  `grid-layout-${organizationId}-${dashboardId}`;

export const getDashboardLayout = (widgets: Widget[]): Layout[] => {
  return widgets
    .filter(({layout}) => !!layout)
    .map(({layout, ...widget}) => ({
      ...(layout as Layout),
      i: constructGridItemKey(widget),
    }));
};

export const saveDashboardLayout = (
  organizationId: string,
  dashboardId: string,
  layout: Layout[]
) => {
  localStorage.setItem(
    getLocalStorageKey(organizationId, dashboardId),
    JSON.stringify(layout)
  );
};

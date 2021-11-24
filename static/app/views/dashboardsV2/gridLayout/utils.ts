import {Layout} from 'react-grid-layout';

const getLocalStorageKey = (organizationId: string, dashboardId: string) =>
  `grid-layout-${organizationId}-${dashboardId}`;

export const getDashboardLayout = (organizationId, dashboardId): Layout[] => {
  const savedLayoutString = global.localStorage.getItem(
    getLocalStorageKey(organizationId, dashboardId)
  );

  if (savedLayoutString) {
    return JSON.parse(savedLayoutString);
  }

  return [];
};

export const saveDashboardLayout = (
  organizationId: string,
  dashboardId: string,
  layout: Layout[]
) => {
  global.localStorage.setItem(
    getLocalStorageKey(organizationId, dashboardId),
    JSON.stringify(layout)
  );
};

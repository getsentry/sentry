export type DashboardsEventParameters = {
  'dashboards_views.add_widget_modal.change': {
    from: string;
    field: string;
    value: string;
  };
};

export type DashboardsEventKey = keyof DashboardsEventParameters;

export const dashboardsEventMap: Record<DashboardsEventKey, string | null> = {
  'dashboards_views.add_widget_modal.change':
    'dashboards Views: Field changed in Add Widget Modal',
};

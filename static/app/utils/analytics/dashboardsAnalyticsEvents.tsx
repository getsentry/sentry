export type DashboardsEventParameters = {
  'dashboards_views.add_widget_modal.opened': {};
  'dashboards_views.add_widget_modal.change': {
    from: string;
    field: string;
    value: string;
  };
  'dashboards_views.edit_widget_modal.opened': {};
  'dashboards_views.query_selector.opened': {
    widget_type: string;
  };
  'dashboards_views.query_selector.selected': {
    widget_type: string;
  };
  'dashboards_views.open_in_discover.opened': {
    widget_type: string;
  };
};

export type DashboardsEventKey = keyof DashboardsEventParameters;

export const dashboardsEventMap: Record<DashboardsEventKey, string | null> = {
  'dashboards_views.add_widget_modal.opened': 'Dashboards2: Add Widget Modal opened',
  'dashboards_views.add_widget_modal.change':
    'Dashboards2: Field changed in Add Widget Modal',
  'dashboards_views.edit_widget_modal.opened': 'Dashboards2: Edit Widget Modal Opened',
  'dashboards_views.query_selector.opened':
    'Dashboards2: Query Selector opened for Widget',
  'dashboards_views.query_selector.selected':
    'Dashboards2: Query selected in Query Selector',
  'dashboards_views.open_in_discover.opened': 'Dashboards2: Widget Opened In Discover',
};

import type {DashboardsLayout} from 'sentry/views/dashboards/manage';

// Used in the full-page widget builder
type DashboardsEventParametersWidgetBuilder = {
  'dashboards_views.widget_builder.change': {
    field: string;
    from: string;
    new_widget: boolean;
    value: string;
    widget_type: string;
  };
  'dashboards_views.widget_builder.opened': {
    new_widget: boolean;
  };
  'dashboards_views.widget_builder.save': {
    data_set: string;
    new_widget: boolean;
  };
};

const dashboardsEventMapWidgetBuilder: Record<
  keyof DashboardsEventParametersWidgetBuilder,
  string | null
> = {
  'dashboards_views.widget_builder.change': 'Widget Builder: Field changed',
  'dashboards_views.widget_builder.save': 'Widget Builder: Form submitted',
  'dashboards_views.widget_builder.opened': 'Widget Builder: Page opened',
};

export type DashboardsEventParameters = {
  'dashboards2.create.cancel': {};
  'dashboards2.create.complete': {};
  'dashboards2.delete': {};
  'dashboards2.edit.cancel': {};
  'dashboards2.edit.complete': {};
  'dashboards2.edit.start': {};
  'dashboards2.edit_access.save': {
    editable_by: 'owner_only' | 'all' | 'team_selection';
    team_count?: number;
  };
  'dashboards2.edit_access.start': {};
  'dashboards2.filter.cancel': {};
  'dashboards2.filter.change': {filter_type: string};
  'dashboards2.filter.save': {};
  'dashboards_manage.change_sort': {
    sort: string;
  };
  'dashboards_manage.change_view_type': {
    view_type: DashboardsLayout;
  };
  'dashboards_manage.create.start': {};
  'dashboards_manage.delete': {dashboard_id: number; view_type: DashboardsLayout};
  'dashboards_manage.duplicate': {dashboard_id: number; view_type: DashboardsLayout};
  'dashboards_manage.paginate': {};
  'dashboards_manage.search': {};
  'dashboards_manage.templates.add': {
    dashboard_id: string;
    dashboard_title: string;
    was_previewed: boolean;
  };
  'dashboards_manage.templates.preview': {
    dashboard_id: string;
  };
  'dashboards_manage.templates.toggle': {
    show_templates: boolean;
  };
  'dashboards_manage.toggle_favorite': {dashboard_id: string; favorited: boolean};
  'dashboards_views.open_in_discover.opened': {
    widget_type: string;
  };
  'dashboards_views.query_selector.opened': {
    widget_type: string;
  };
  'dashboards_views.query_selector.selected': {
    widget_type: string;
  };
  'dashboards_views.widget.delete': {
    widget_type: string;
  };
  'dashboards_views.widget.duplicate': {
    widget_type: string;
  };
  'dashboards_views.widget.edit': {
    widget_type: string;
  };
  'dashboards_views.widget_library.add_widget': {
    title: string;
  };
  'dashboards_views.widget_library.opened': {};
  'dashboards_views.widget_viewer.edit': {
    display_type: string;
    widget_type: string;
  };
  'dashboards_views.widget_viewer.open': {
    display_type: string;
    widget_type: string;
  };
  'dashboards_views.widget_viewer.open_source': {
    display_type: string;
    widget_type: string;
  };
  'dashboards_views.widget_viewer.paginate': {
    display_type: string;
    widget_type: string;
  };
  'dashboards_views.widget_viewer.select_query': {
    display_type: string;
    widget_type: string;
  };
  'dashboards_views.widget_viewer.sort': {
    column: string;
    display_type: string;
    order: string;
    widget_type: string;
  };
  'dashboards_views.widget_viewer.toggle_legend': {
    display_type: string;
    widget_type: string;
  };
  'dashboards_views.widget_viewer.zoom': {
    display_type: string;
    widget_type: string;
  };
} & DashboardsEventParametersWidgetBuilder;

export type DashboardsEventKey = keyof DashboardsEventParameters;

export const dashboardsEventMap: Record<DashboardsEventKey, string | null> = {
  'dashboards2.create.cancel': 'Dashboards2: Create cancel',
  'dashboards2.create.complete': 'Dashboards2: Create complete',
  'dashboards2.delete': 'Dashboards2: Delete',
  'dashboards2.edit.cancel': 'Dashboards2: Edit cancel',
  'dashboards2.edit.complete': 'Dashboards2: Edit complete',
  'dashboards2.edit.start': 'Dashboards2: Edit start',
  'dashboards2.filter.save': 'Dashboards2: Filter bar save',
  'dashboards2.filter.cancel': 'Dashboards2: Filter bar cancel',
  'dashboards2.filter.change': 'Dashboards2: Filter bar changed',
  'dashboards_views.query_selector.opened':
    'Dashboards2: Query Selector opened for Widget',
  'dashboards_views.query_selector.selected':
    'Dashboards2: Query selected in Query Selector',
  'dashboards_views.widget.edit': 'Dashboards2: dashboard widget edited',
  'dashboards_views.widget.duplicate': 'Dashboards2: dashboard widget duplicated',
  'dashboards_views.widget.delete': 'Dashboards2: dashboard widget deleted',
  'dashboards_views.open_in_discover.opened': 'Dashboards2: Widget Opened In Discover',
  'dashboards_views.widget_library.add_widget':
    'Dashboards2: Title of prebuilt widget added',
  'dashboards_views.widget_library.opened': 'Dashboards2: Add Widget Library opened',
  'dashboards_manage.search': 'Dashboards Manager: Search',
  'dashboards_manage.change_sort': 'Dashboards Manager: Sort By Changed',
  'dashboards_manage.change_view_type': 'Dashboards Manager: View Type Toggled',
  'dashboards_manage.create.start': 'Dashboards Manager: Dashboard Create Started',
  'dashboards_manage.delete': 'Dashboards Manager: Dashboard Deleted',
  'dashboards_manage.duplicate': 'Dashboards Manager: Dashboard Duplicated',
  'dashboards_manage.paginate': 'Dashboards Manager: Paginate',
  'dashboards_manage.templates.toggle': 'Dashboards Manager: Template Toggle Changed',
  'dashboards_manage.templates.add': 'Dashboards Manager: Template Added',
  'dashboards_manage.templates.preview': 'Dashboards Manager: Template Previewed',
  'dashboards_manage.toggle_favorite': 'Dashboards Manager: Dashboard Favorite Toggled',
  'dashboards_views.widget_viewer.edit': 'Widget Viewer: Edit Widget Modal Opened',
  'dashboards_views.widget_viewer.open': 'Widget Viewer: Opened',
  'dashboards_views.widget_viewer.open_source':
    'Widget Viewer: Opened in Discover/Issues',
  'dashboards_views.widget_viewer.paginate': 'Widget Viewer: Paginate',
  'dashboards_views.widget_viewer.select_query': 'Widget Viewer: Query Selected',
  'dashboards_views.widget_viewer.sort': 'Widget Viewer: Table Sorted',
  'dashboards_views.widget_viewer.toggle_legend': 'Widget Viewer: Legend Toggled',
  'dashboards_views.widget_viewer.zoom': 'Widget Viewer: Chart zoomed',
  'dashboards2.edit_access.start': 'Dashboards2: Edit Access Dropdown Opened',
  'dashboards2.edit_access.save': 'Dashboards2: Edit Access Dropdown Selection Saved',
  ...dashboardsEventMapWidgetBuilder,
};

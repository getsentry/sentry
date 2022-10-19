// The add/edit widget modal is currently being ported to the widget builder full-page and
// this will be removed once that is done.
type DashboardsEventParametersAddWidgetModal = {
  'dashboards_views.add_widget_modal.change': {
    field: string;
    from: string;
    value: string;
    widget_type: string;
  };
  'dashboards_views.add_widget_modal.confirm': {
    data_set: string;
  };
  'dashboards_views.add_widget_modal.opened': {};
  'dashboards_views.add_widget_modal.save': {
    data_set: string;
  };
  'dashboards_views.edit_widget_modal.confirm': {};
  'dashboards_views.edit_widget_modal.opened': {};
};

const dashboardsEventMapAddWidgetModal: Record<
  keyof DashboardsEventParametersAddWidgetModal,
  string | null
> = {
  'dashboards_views.edit_widget_modal.confirm':
    'Dashboards2: Edit Dashboard Widget modal form submitted',
  'dashboards_views.edit_widget_modal.opened': 'Dashboards2: Edit Widget Modal Opened',
  'dashboards_views.add_widget_modal.opened': 'Dashboards2: Add Widget Modal opened',
  'dashboards_views.add_widget_modal.change':
    'Dashboards2: Field changed in Add Widget Modal',
  'dashboards_views.add_widget_modal.confirm':
    'Dashboards2: Add Widget to Dashboard modal form submitted',
  'dashboards_views.add_widget_modal.save':
    'Dashboards2: Widget saved directly to Dashboard from Add Widget to Dashboard modal',
};

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
  'dashboards_manage.change_sort': {
    sort: string;
  };
  'dashboards_manage.create.start': {};
  'dashboards_manage.delete': {dashboard_id: number};
  'dashboards_manage.duplicate': {dashboard_id: number};
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
  'dashboards_views.open_in_discover.opened': {
    widget_type: string;
  };
  'dashboards_views.query_selector.opened': {
    widget_type: string;
  };
  'dashboards_views.query_selector.selected': {
    widget_type: string;
  };
  'dashboards_views.widget_library.add': {
    num_widgets: number;
  };
  'dashboards_views.widget_library.add_widget': {
    title: string;
  };
  'dashboards_views.widget_library.opened': {};
  'dashboards_views.widget_library.switch_tab': {
    to: string;
  };
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
} & DashboardsEventParametersAddWidgetModal &
  DashboardsEventParametersWidgetBuilder;

export type DashboardsEventKey = keyof DashboardsEventParameters;

export const dashboardsEventMap: Record<DashboardsEventKey, string | null> = {
  'dashboards2.create.cancel': 'Dashboards2: Create cancel',
  'dashboards2.create.complete': 'Dashboards2: Create complete',
  'dashboards2.delete': 'Dashboards2: Delete',
  'dashboards2.edit.cancel': 'Dashboards2: Edit cancel',
  'dashboards2.edit.complete': 'Dashboards2: Edit complete',
  'dashboards2.edit.start': 'Dashboards2: Edit start',
  'dashboards_views.query_selector.opened':
    'Dashboards2: Query Selector opened for Widget',
  'dashboards_views.query_selector.selected':
    'Dashboards2: Query selected in Query Selector',
  'dashboards_views.open_in_discover.opened': 'Dashboards2: Widget Opened In Discover',
  'dashboards_views.widget_library.add': 'Dashboards2: Number of prebuilt widgets added',
  'dashboards_views.widget_library.add_widget':
    'Dashboards2: Title of prebuilt widget added',
  'dashboards_views.widget_library.switch_tab':
    'Dashboards2: Widget Library tab switched',
  'dashboards_views.widget_library.opened': 'Dashboards2: Add Widget Library opened',
  'dashboards_manage.search': 'Dashboards Manager: Search',
  'dashboards_manage.change_sort': 'Dashboards Manager: Sort By Changed',
  'dashboards_manage.create.start': 'Dashboards Manager: Dashboard Create Started',
  'dashboards_manage.delete': 'Dashboards Manager: Dashboard Deleted',
  'dashboards_manage.duplicate': 'Dashboards Manager: Dashboard Duplicated',
  'dashboards_manage.paginate': 'Dashboards Manager: Paginate',
  'dashboards_manage.templates.toggle': 'Dashboards Manager: Template Toggle Changed',
  'dashboards_manage.templates.add': 'Dashboards Manager: Template Added',
  'dashboards_manage.templates.preview': 'Dashboards Manager: Template Previewed',
  'dashboards_views.widget_viewer.edit': 'Widget Viewer: Edit Widget Modal Opened',
  'dashboards_views.widget_viewer.open': 'Widget Viewer: Opened',
  'dashboards_views.widget_viewer.open_source':
    'Widget Viewer: Opened in Discover/Issues',
  'dashboards_views.widget_viewer.paginate': 'Widget Viewer: Paginate',
  'dashboards_views.widget_viewer.select_query': 'Widget Viewer: Query Selected',
  'dashboards_views.widget_viewer.sort': 'Widget Viewer: Table Sorted',
  'dashboards_views.widget_viewer.toggle_legend': 'Widget Viewer: Legend Toggled',
  'dashboards_views.widget_viewer.zoom': 'Widget Viewer: Chart zoomed',
  ...dashboardsEventMapAddWidgetModal,
  ...dashboardsEventMapWidgetBuilder,
};

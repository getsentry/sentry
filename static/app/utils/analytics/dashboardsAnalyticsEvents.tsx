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

// Used in the widget builder full-page
type DashboardsEventParametersAddWidgetInBuilder = {
  'dashboards_views.add_widget_in_builder.change': {
    field: string;
    from: string;
    value: string;
    widget_type: string;
  };
  'dashboards_views.add_widget_in_builder.confirm': {
    data_set: string;
  };
  'dashboards_views.add_widget_in_builder.opened': {};
  // TODO(widget-builder-experience): Port the analytics code as soon as we can persist a widget from the widget library
  'dashboards_views.add_widget_in_builder.save': {
    data_set: string;
  };
  'dashboards_views.edit_widget_in_builder.confirm': {};
  'dashboards_views.edit_widget_in_builder.opened': {};
};

const dashboardsEventMapAddWidgetInBuilder: Record<
  keyof DashboardsEventParametersAddWidgetInBuilder,
  string | null
> = {
  'dashboards_views.edit_widget_in_builder.confirm':
    'Dashboards2: Edit dashboard widget builder form submitted',
  'dashboards_views.edit_widget_in_builder.opened':
    'Dashboards2: Edit widget in builder opened',
  'dashboards_views.add_widget_in_builder.opened':
    'Dashboards2: Add widget in builder opened',
  'dashboards_views.add_widget_in_builder.change':
    'Dashboards2: Field changed in builder',
  'dashboards_views.add_widget_in_builder.confirm':
    'Dashboards2: Add widget to dashboard widget builder form submitted',
  'dashboards_views.add_widget_in_builder.save':
    'Dashboards2: Widget saved directly to dashboard from add widget to dashboard widget builder',
};

export type DashboardsEventParameters = {
  'dashboards_manage.change_sort': {
    sort: string;
  };
  'dashboards_manage.create.start': {};
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
  DashboardsEventParametersAddWidgetInBuilder;

export type DashboardsEventKey = keyof DashboardsEventParameters;

export const dashboardsEventMap: Record<DashboardsEventKey, string | null> = {
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
  ...dashboardsEventMapAddWidgetInBuilder,
};

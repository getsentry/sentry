export type DDMEventParameters = {
  'ddm.add-to-dashboard': {
    source: 'global' | 'widget';
  };
  'ddm.code-location': {};
  'ddm.create-alert': {
    source: 'global' | 'widget';
  };
  'ddm.open-onboarding': {
    source: 'onboarding_panel' | 'header' | 'banner';
  };
  'ddm.page-view': {};
  'ddm.remove-default-query': {};
  'ddm.sample-table-interaction': {
    target: 'event-id' | 'description' | 'trace-id' | 'profile';
  };
  'ddm.set-default-query': {};
  'ddm.span-metric.create.cancel': {};
  'ddm.span-metric.create.open': {
    source: string;
  };
  'ddm.span-metric.create.success': {
    hasFilters: boolean;
  };
  'ddm.span-metric.delete': {};
  'ddm.span-metric.edit.cancel': {};
  'ddm.span-metric.edit.open': {
    hasFilters: boolean;
    source: string;
  };
  'ddm.span-metric.edit.success': {
    hasFilters: boolean;
  };
  'ddm.span-metric.form.add-filter': {};
  'ddm.span-metric.form.remove-filter': {};
  'ddm.view_performance_metrics': {};
  'ddm.widget.add': {
    type: 'query' | 'equation';
  };
  'ddm.widget.condition': {};
  'ddm.widget.duplicate': {};
  'ddm.widget.filter': {};
  'ddm.widget.group': {};
  'ddm.widget.metric': {};
  'ddm.widget.metric-settings': {};
  'ddm.widget.operation': {};
  'ddm.widget.sort': {
    by: string;
    order: string;
  };
};

export const ddmEventMap: Record<keyof DDMEventParameters, string> = {
  'ddm.page-view': 'DDM: Page View',
  'ddm.remove-default-query': 'DDM: Remove Default Query',
  'ddm.set-default-query': 'DDM: Set Default Query',
  'ddm.open-onboarding': 'DDM: Open Onboarding',
  'ddm.view_performance_metrics': 'DDM: View Performance Metrics',
  'ddm.widget.add': 'DDM: Widget Added',
  'ddm.widget.sort': 'DDM: Group By Sort Changed',
  'ddm.widget.duplicate': 'DDM: Widget Duplicated',
  'ddm.widget.metric-settings': 'DDM: Widget Metric Settings',
  'ddm.create-alert': 'DDM: Create Alert',
  'ddm.add-to-dashboard': 'DDM: Add to Dashboard',
  'ddm.code-location': 'DDM: Code Location',
  'ddm.sample-table-interaction': 'DDM: Sample Table Interaction',
  'ddm.widget.filter': 'DDM: Change query filter',
  'ddm.widget.group': 'DDM: Change query grouping',
  'ddm.widget.metric': 'DDM: Change query metric',
  'ddm.widget.operation': 'DDM: Change query operation',
  'ddm.widget.condition': 'DDM: Change query condition',
  'ddm.span-metric.create.cancel': 'DDM: Cancel span metric create',
  'ddm.span-metric.create.open': 'DDM: Open span metric create',
  'ddm.span-metric.create.success': 'DDM: Created span metric',
  'ddm.span-metric.delete': 'DDM: Delete span metric',
  'ddm.span-metric.edit.cancel': 'DDM: Cancel span metric edit',
  'ddm.span-metric.edit.open': 'DDM: Open span metric edit',
  'ddm.span-metric.edit.success': 'DDM: Edited span metric',
  'ddm.span-metric.form.add-filter': 'DDM: Add filter in span metric form',
  'ddm.span-metric.form.remove-filter': 'DDM: Remove filter in span metric form',
};

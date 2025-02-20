export type DDMEventParameters = {
  'ddm.add-to-dashboard': {
    source: 'global' | 'widget';
  };
  'ddm.code-location': Record<string, unknown>;
  'ddm.create-alert': {
    source: 'global' | 'widget';
  };
  'ddm.open-onboarding': {
    source: 'onboarding_panel' | 'header' | 'banner';
  };
  'ddm.page-view': Record<string, unknown>;
  'ddm.remove-default-query': Record<string, unknown>;
  'ddm.sample-table-interaction': {
    target: 'event-id' | 'description' | 'trace-id' | 'profile';
  };
  'ddm.set-default-query': Record<string, unknown>;
  'ddm.span-metric.create.cancel': Record<string, unknown>;
  'ddm.span-metric.create.open': {
    source: string;
  };
  'ddm.span-metric.create.success': {
    hasFilters: boolean;
  };
  'ddm.span-metric.delete': Record<string, unknown>;
  'ddm.span-metric.edit.cancel': Record<string, unknown>;
  'ddm.span-metric.edit.open': {
    hasFilters: boolean;
    source: string;
  };
  'ddm.span-metric.edit.success': {
    hasFilters: boolean;
  };
  'ddm.span-metric.form.add-filter': Record<string, unknown>;
  'ddm.span-metric.form.remove-filter': Record<string, unknown>;
  'ddm.view_performance_metrics': Record<string, unknown>;
  'ddm.widget.add': {
    type: 'query' | 'equation';
  };
  'ddm.widget.condition': Record<string, unknown>;
  'ddm.widget.duplicate': Record<string, unknown>;
  'ddm.widget.filter': Record<string, unknown>;
  'ddm.widget.group': Record<string, unknown>;
  'ddm.widget.metric': Record<string, unknown>;
  'ddm.widget.metric-settings': Record<string, unknown>;
  'ddm.widget.operation': Record<string, unknown>;
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

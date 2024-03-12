export type DDMEventParameters = {
  'ddm.add-to-dashboard': {
    source: 'global' | 'widget';
  };
  'ddm.code-location': {};
  'ddm.create-alert': {
    source: 'global' | 'widget';
  };
  'ddm.open-onboarding': {
    source: 'onboarding_panel' | 'header';
  };
  'ddm.page-view': {};
  'ddm.remove-default-query': {};
  'ddm.sample-table-interaction': {
    target: 'event-id' | 'transaction' | 'trace-id' | 'profile';
  };
  'ddm.set-default-query': {};
  'ddm.widget.add': {
    type: 'query' | 'equation';
  };
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
};

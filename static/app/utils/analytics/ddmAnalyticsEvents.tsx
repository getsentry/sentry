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
  'ddm.widget.add': {};
  'ddm.widget.duplicate': {};
  'ddm.widget.metric-settings': {};
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
};

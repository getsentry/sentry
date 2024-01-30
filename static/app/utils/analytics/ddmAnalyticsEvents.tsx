export type DDMEventParameters = {
  'ddm.add-to-dashboard': {
    source: 'global' | 'widget';
  };
  'ddm.code-location': {};
  'ddm.create-alert': {
    source: 'global' | 'widget';
  };
  'ddm.page-view': {};
  'ddm.sample-table-interaction': {
    target: 'event-id' | 'transaction' | 'trace-id' | 'profile';
  };
  'ddm.scratchpad.remove': {};
  'ddm.scratchpad.save': {};
  'ddm.scratchpad.set-default': {};
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
  'ddm.scratchpad.remove': 'DDM: Scratchpad Removed',
  'ddm.scratchpad.save': 'DDM: Scratchpad Saved',
  'ddm.scratchpad.set-default': 'DDM: Scratchpad Set as Default',
  'ddm.widget.add': 'DDM: Widget Added',
  'ddm.widget.sort': 'DDM: Group By Sort Changed',
  'ddm.widget.duplicate': 'DDM: Widget Duplicated',
  'ddm.widget.metric-settings': 'DDM: Widget Metric Settings',
  'ddm.create-alert': 'DDM: Create Alert',
  'ddm.add-to-dashboard': 'DDM: Add to Dashboard',
  'ddm.code-location': 'DDM: Code Location',
  'ddm.sample-table-interaction': 'DDM: Sample Table Interaction',
};

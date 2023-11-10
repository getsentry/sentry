export type DDMEventParameters = {
  'ddm.page-view': {};
  'ddm.scratchpad.remove': {};
  'ddm.scratchpad.save': {};
  'ddm.scratchpad.set-default': {};
  'ddm.widget.add': {};
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
};

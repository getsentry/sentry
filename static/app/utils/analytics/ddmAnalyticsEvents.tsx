export type DDMEventParameters = {
  'ddm.page-view': {
    organization: string;
  };
  'ddm.scratchpad.remove': {
    organization: string;
  };
  'ddm.scratchpad.save': {
    organization: string;
  };
  'ddm.scratchpad.set-default': {
    organization: string;
  };
  'ddm.widget.add': {
    organization: string;
  };
  'ddm.widget.sort': {
    by: string;
    order: string;
    organization: string;
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

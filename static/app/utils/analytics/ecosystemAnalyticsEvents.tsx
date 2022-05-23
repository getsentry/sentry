type View = {
  view?: 'integrations_directory' | 'developer_settings';
};

type ReferenceImplementationEventParams = {} & View;

export type EcosystemEventParameters = {
  'ecosystem.example_source_code_clicked': ReferenceImplementationEventParams;
  'ecosystem.quick_start_clicked': ReferenceImplementationEventParams;
};

export type EcosystemEventKey = keyof EcosystemEventParameters;

export const ecosystemEventMap: Record<EcosystemEventKey, string | null> = {
  'ecosystem.quick_start_clicked':
    'Ecosystem: Integration platform quick start link clicked',
  'ecosystem.example_source_code_clicked':
    'Ecosystem: Reference Implementation source code link clicked',
};

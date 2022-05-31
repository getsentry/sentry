type View = {
  view?: 'integrations_directory' | 'developer_settings';
};

type ExampleAppEventParams = {} & View;

export type EcosystemEventParameters = {
  'ecosystem.integration_platform_example_docs_clicked': ExampleAppEventParams;
  'ecosystem.integration_platform_example_source_code_clicked': ExampleAppEventParams;
};

export type EcosystemEventKey = keyof EcosystemEventParameters;

export const ecosystemEventMap: Record<EcosystemEventKey, string | null> = {
  'ecosystem.integration_platform_example_docs_clicked':
    'Ecosystem: Integration platform example app docs link clicked',
  'ecosystem.integration_platform_example_source_code_clicked':
    'Ecosystem: Integration platform example app source code link clicked',
};

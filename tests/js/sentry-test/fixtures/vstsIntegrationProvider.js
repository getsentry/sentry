export function VstsIntegrationProvider(params = {}) {
  return {
    key: 'vsts',
    name: 'VSTS',
    canAdd: true,
    config: [],
    features: [],
    metadata: {
      description: '*markdown* formatted VSTS _description_',
      features: [{description: '*markdown* feature description'}],
      author: 'Frank',
      noun: 'Instance',
      issue_url: 'http://example.com/vsts_issue_url',
      source_url: 'http://example.com/vsts_source_url',
      aspects: {},
    },
    ...params,
  };
}

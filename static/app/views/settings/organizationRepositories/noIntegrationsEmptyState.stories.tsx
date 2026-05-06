import * as Storybook from 'sentry/stories';
import type {IntegrationProvider} from 'sentry/types/integrations';
import {NoIntegrationsEmptyState} from 'sentry/views/settings/organizationRepositories/noIntegrationsEmptyState';

function makeProvider(key: string, name: string): IntegrationProvider {
  return {
    key,
    slug: key,
    name,
    canAdd: true,
    canDisable: false,
    features: [],
    setupDialog: {url: '', width: 600, height: 600},
    metadata: {
      description: '',
      features: [],
      author: 'Sentry',
      noun: 'Installation',
      issue_url: '',
      source_url: '',
      aspects: {},
    },
  };
}

const SCM_PROVIDERS: IntegrationProvider[] = [
  makeProvider('github', 'GitHub'),
  makeProvider('github_enterprise', 'GitHub Enterprise'),
  makeProvider('gitlab', 'GitLab'),
  makeProvider('bitbucket', 'Bitbucket'),
  makeProvider('bitbucket_server', 'Bitbucket Server'),
  makeProvider('vsts', 'Azure DevOps'),
];

export default Storybook.story('NoIntegrationsEmptyState', story => {
  story('Default', () => (
    <NoIntegrationsEmptyState providers={SCM_PROVIDERS} onAddIntegration={() => {}} />
  ));
});

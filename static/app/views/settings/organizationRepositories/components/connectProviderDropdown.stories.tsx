import * as Storybook from 'sentry/stories';
import type {IntegrationProvider} from 'sentry/types/integrations';

import {ConnectProviderDropdown} from './connectProviderDropdown';

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
  makeProvider('gitlab', 'GitLab'),
  makeProvider('bitbucket', 'Bitbucket'),
  makeProvider('vsts', 'Azure DevOps'),
  makeProvider('github_enterprise', 'GitHub Enterprise'),
  makeProvider('bitbucket_server', 'Bitbucket Server'),
];

export default Storybook.story('ConnectProviderDropdown', story => {
  story('Default', () => (
    <ConnectProviderDropdown providers={SCM_PROVIDERS} onAddIntegration={() => {}} />
  ));

  story('Without Seer-compatible providers', () => (
    <ConnectProviderDropdown
      providers={[
        makeProvider('bitbucket', 'Bitbucket'),
        makeProvider('vsts', 'Azure DevOps'),
      ]}
      onAddIntegration={() => {}}
    />
  ));
});

import {useMemo, useState} from 'react';

import {Input} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';
import type {
  Integration,
  IntegrationProvider,
  Repository,
} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';

import type {ScmInstallation} from './scmRepositoryTable';
import {ScmRepositoryTable} from './scmRepositoryTable';
import {useRepoSearch} from './useRepoSearch';

const GITHUB_PROVIDER: IntegrationProvider = {
  key: 'github',
  slug: 'github',
  name: 'GitHub',
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

function makeIntegration(id: string, name: string): Integration {
  return {
    id,
    name,
    accountType: '',
    domainName: `github.com/${name}`,
    gracePeriodEnd: null,
    icon: null,
    organizationIntegrationStatus: 'active',
    status: 'active',
    provider: {
      key: 'github',
      slug: 'github',
      name: 'GitHub',
      canAdd: true,
      canDisable: false,
      features: [],
      aspects: {},
    },
  };
}

function makeRepo(id: string, name: string): Repository {
  return {
    id,
    name,
    url: `https://github.com/${name}`,
    provider: {id: 'integrations:github', name: 'GitHub'},
    status: RepositoryStatus.ACTIVE,
    externalSlug: name,
    externalId: id,
    dateCreated: '',
    integrationId: '',
  };
}

const REPO_NAMES = [
  'org-name/repo-name',
  'org-name/repo-name-123',
  'org-name/repo-name-abc',
  'org-name/repo-name-kiwi-lemon',
  'org-name/repo-name-mango-habanero',
  'org-name/repo-name-empanada',
];

const INSTALLATIONS: ScmInstallation[] = [
  {
    integration: makeIntegration('1', '@org-name-123'),
    repositories: REPO_NAMES.map((name, i) => makeRepo(`a-${i}`, name)),
    manageUrl: 'https://github.com/',
  },
  {
    integration: makeIntegration('2', '@org-name-456'),
    repositories: REPO_NAMES.map((name, i) => makeRepo(`b-${i}`, name)),
    manageUrl: 'https://github.com/',
    initiallyExpanded: true,
  },
];

const EMPTY_INSTALLATION: ScmInstallation[] = [
  {
    integration: makeIntegration('1', '@org-name-123'),
    repositories: [],
    manageUrl: 'https://github.com/',
    initiallyExpanded: true,
  },
];

export default Storybook.story('ScmRepositoryTable', story => {
  story('Default', () => (
    <ScmRepositoryTable
      provider={GITHUB_PROVIDER}
      installations={INSTALLATIONS}
      onDelete={() => {}}
      settingsTo="#"
      overflowMenuItems={[
        {key: 'disable', label: 'Disable integration', onAction: () => {}},
      ]}
      lastSyncedAt={new Date(Date.now() - 5 * 60 * 1000)}
      onSync={() => {}}
    />
  ));

  story('Empty installation', () => (
    <ScmRepositoryTable
      provider={GITHUB_PROVIDER}
      installations={EMPTY_INSTALLATION}
      onDelete={() => {}}
      settingsTo="#"
      overflowMenuItems={[
        {key: 'disable', label: 'Disable integration', onAction: () => {}},
      ]}
      lastSyncedAt={new Date(Date.now() - 5 * 60 * 1000)}
      onSync={() => {}}
    />
  ));

  story('With search', () => {
    const [query, setQuery] = useState('');
    const allRepos = useMemo(() => INSTALLATIONS.flatMap(i => i.repositories), []);
    const repoMatches = useRepoSearch(allRepos, query);

    return (
      <Flex direction="column" gap="md">
        <Input
          type="search"
          placeholder="Search repositories"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <ScmRepositoryTable
          provider={GITHUB_PROVIDER}
          installations={INSTALLATIONS.map(i => ({...i, initiallyExpanded: true}))}
          repoMatches={repoMatches}
          onDelete={() => {}}
          settingsTo="#"
        />
      </Flex>
    );
  });

  story('Loading and disabled', () => (
    <ScmRepositoryTable
      provider={GITHUB_PROVIDER}
      installations={[
        {
          integration: makeIntegration('1', '@org-name-123'),
          repositories: REPO_NAMES.map((name, i) => makeRepo(`a-${i}`, name)),
          manageUrl: 'https://github.com/',
          isLoading: true,
          initiallyExpanded: true,
        },
        {
          integration: {
            ...makeIntegration('2', '@org-name-456'),
            status: 'disabled',
          },
          repositories: [],
          manageUrl: 'https://github.com/',
          expandDisabled: true,
        },
      ]}
      onDelete={() => {}}
      settingsTo="#"
    />
  ));
});

import {useMemo, useState} from 'react';

import {Input} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';
import type {
  IntegrationProvider,
  OrganizationIntegration,
  Repository,
} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';
import {useProjects} from 'sentry/utils/useProjects';
import {useRepoSearch} from 'sentry/views/settings/organizationRepositories/hooks/useRepoSearch';
import type {ScmInstallation} from 'sentry/views/settings/organizationRepositories/types';

import {ScmRepositoryTable} from './scmRepositoryTable';

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

function makeIntegration(id: string, name: string): OrganizationIntegration {
  return {
    id,
    name,
    accountType: '',
    domainName: `github.com/${name}`,
    gracePeriodEnd: null,
    icon: null,
    organizationIntegrationStatus: 'active',
    status: 'active',
    configData: null,
    configOrganization: [],
    externalId: id,
    organizationId: '',
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

/**
 * Deterministically pick a subset of project slugs for a given repo index, so
 * the story shows a realistic mix of "no mapping", "single project", and
 * "many projects (with +N collapse)" rows without reshuffling on every render.
 */
function pickSlugsForRepo(allSlugs: string[], repoIndex: number): string[] {
  if (allSlugs.length === 0) return [];
  const counts = [0, 1, 1, 3, 0, 5];
  const count = Math.min(counts[repoIndex % counts.length]!, allSlugs.length);
  const start = (repoIndex * 3) % allSlugs.length;
  return Array.from({length: count}, (_, i) => allSlugs[(start + i) % allSlugs.length]!);
}

function useStoryInstallations(): ScmInstallation[] {
  const {projects} = useProjects();
  return useMemo(() => {
    const slugs = projects.map(p => p.slug);
    const buildMap = (prefix: string) =>
      Object.fromEntries(
        REPO_NAMES.map((_, i) => [
          `${prefix}-${i}`,
          pickSlugsForRepo(slugs, i + 1),
        ]).filter(([, list]) => (list as string[]).length > 0)
      );
    return [
      {
        integration: makeIntegration('1', '@org-name-123'),
        repositories: REPO_NAMES.map((name, i) => makeRepo(`a-${i}`, name)),
        mappedProjectSlugsByRepoId: buildMap('a'),
        manageUrl: 'https://github.com/',
      },
      {
        integration: makeIntegration('2', '@org-name-456'),
        repositories: REPO_NAMES.map((name, i) => makeRepo(`b-${i}`, name)),
        mappedProjectSlugsByRepoId: buildMap('b'),
        manageUrl: 'https://github.com/',
        initiallyExpanded: true,
      },
    ];
  }, [projects]);
}

const EMPTY_INSTALLATION: ScmInstallation[] = [
  {
    integration: makeIntegration('1', '@org-name-123'),
    repositories: [],
    manageUrl: 'https://github.com/',
    initiallyExpanded: true,
  },
];

export default Storybook.story('ScmRepositoryTable', story => {
  story('Default', () => {
    const installations = useStoryInstallations();
    return (
      <ScmRepositoryTable
        provider={GITHUB_PROVIDER}
        installations={installations.map((inst, i) => ({
          ...inst,
          integration: {
            ...inst.integration,
            configData: {
              last_sync: new Date(Date.now() - (i + 1) * 5 * 60 * 1000).toISOString(),
            },
          },
        }))}
        // no sync button
      />
    );
  });

  story('Empty installation', () => (
    <ScmRepositoryTable
      provider={GITHUB_PROVIDER}
      installations={EMPTY_INSTALLATION}
      // no sync button
    />
  ));

  story('With search', () => {
    const [query, setQuery] = useState('');
    const installations = useStoryInstallations();
    const allRepos = useMemo(
      () => installations.flatMap(i => i.repositories),
      [installations]
    );
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
          installations={installations.map(i => ({...i, initiallyExpanded: true}))}
          repoMatches={repoMatches}
        />
      </Flex>
    );
  });

  story('Syncing', () => {
    const installations = useStoryInstallations();
    return (
      <ScmRepositoryTable
        provider={GITHUB_PROVIDER}
        installations={installations.map((inst, i) => ({
          ...inst,
          integration: {
            ...inst.integration,
            configData: {
              last_sync: new Date(Date.now() - (i + 1) * 5 * 60 * 1000).toISOString(),
            },
          },
          isSyncing: i === 0,
        }))}
        // no sync button
      />
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
          reposLoading: true,
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
    />
  ));

  story('Mappings loading', () => {
    const installations = useStoryInstallations();
    return (
      <ScmRepositoryTable
        provider={GITHUB_PROVIDER}
        installations={installations.map(i => ({
          ...i,
          // Drop the seeded mappings so every row appears unmapped, then
          // mark the mappings query as in-flight to render the placeholder
          // skeletons in the right slot.
          mappedProjectSlugsByRepoId: {},
          mappingsLoading: true,
        }))}
      />
    );
  });
});

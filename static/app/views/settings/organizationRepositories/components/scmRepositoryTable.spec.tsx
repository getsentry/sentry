import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {Repository} from 'sentry/types/integrations';
import type {ScmInstallation} from 'sentry/views/settings/organizationRepositories/types';

import {InstallationOverrideProvider, ScmRepositoryTable} from './scmRepositoryTable';

// `useVirtualizer` only renders rows whose computed bounding rect overlaps
// the scroll container. Without a stub it sees a 0×0 viewport and renders
// nothing — fake a non-zero box on every element so the rows mount.
function stubBoundingClientRect() {
  jest
    .spyOn(window.Element.prototype, 'getBoundingClientRect')
    .mockImplementation(() => ({
      x: 0,
      y: 0,
      width: 600,
      height: 400,
      left: 0,
      top: 0,
      right: 600,
      bottom: 400,
      toJSON: jest.fn(),
    }));
}

function makeRepo(id: string, name: string): Repository {
  return RepositoryFixture({
    id,
    name,
    externalSlug: name,
    externalId: id,
    integrationId: '1',
  });
}

function makeInstallation(overrides: Partial<ScmInstallation> = {}): ScmInstallation {
  return {
    integration: OrganizationIntegrationsFixture({id: '1'}),
    repositories: [
      makeRepo('1', 'org/aardvark'),
      makeRepo('2', 'org/cobra'),
      makeRepo('3', 'org/badger'),
    ],
    initiallyExpanded: true,
    ...overrides,
  };
}

const provider = GitHubIntegrationProviderFixture();

describe('ScmRepositoryTable', () => {
  beforeEach(() => {
    stubBoundingClientRect();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [
        {id: '1', slug: 'frontend', platform: 'javascript'},
        {id: '2', slug: 'backend', platform: 'python'},
        {id: '3', slug: 'workers', platform: 'node'},
        {id: '4', slug: 'mobile', platform: 'react-native'},
      ],
    });
  });

  it('renders repos for an installation', () => {
    render(
      <ScmRepositoryTable provider={provider} installations={[makeInstallation()]} />
    );

    const region = screen.getByRole('region', {name: 'GitHub'});
    const repoList = within(region).getByRole('list', {name: 'Repositories'});
    expect(within(repoList).getAllByRole('listitem')).toHaveLength(3);
    expect(within(repoList).getByText('org/aardvark')).toBeInTheDocument();
    expect(within(repoList).getByText('org/cobra')).toBeInTheDocument();
    expect(within(repoList).getByText('org/badger')).toBeInTheDocument();
  });

  describe('installation actions', () => {
    it('toggles expansion on click for multi-installation tables', async () => {
      const second: ScmInstallation = {
        ...makeInstallation({initiallyExpanded: false}),
        integration: OrganizationIntegrationsFixture({id: '2', name: '@second-org'}),
        repositories: [makeRepo('10', 'second/repo')],
      };

      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[makeInstallation(), second]}
        />
      );

      const region = screen.getByRole('region', {name: 'GitHub'});
      expect(screen.queryByText('second/repo')).not.toBeInTheDocument();

      await userEvent.click(
        within(region).getByRole('button', {name: '@second-org', expanded: false})
      );

      expect(within(region).getByText('second/repo')).toBeInTheDocument();
    });

    it('wires up settings and delete callbacks', async () => {
      const onUninstall = jest.fn();
      const onSettings = jest.fn();
      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[makeInstallation({onUninstall, onSettings})]}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Integration settings'}));
      expect(onSettings).toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', {name: 'Uninstall'}));
      expect(onUninstall).toHaveBeenCalled();
    });

    it('shows a manage repositories link when manageUrl is provided', () => {
      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[
            makeInstallation({manageUrl: 'https://github.com/apps/sentry-io'}),
          ]}
        />
      );

      expect(screen.getByText('Manage repositories').closest('a')).toHaveAttribute(
        'href',
        'https://github.com/apps/sentry-io'
      );
    });

    it('auto-expands installations with search hits even when collapsed', () => {
      const second: ScmInstallation = {
        ...makeInstallation({initiallyExpanded: false}),
        integration: OrganizationIntegrationsFixture({id: '2', name: '@second-org'}),
        repositories: [makeRepo('10', 'second/repo')],
      };

      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[makeInstallation(), second]}
          repoMatches={{
            // Only a repo in the second installation matches.
            '10': [{key: 'name', value: 'second/repo', indices: [[0, 5]]}],
          }}
        />
      );

      const region = screen.getByRole('region', {name: 'GitHub'});
      const repoLists = within(region).getAllByRole('list', {name: 'Repositories'});
      // The second installation's list should contain the matched repo.
      expect(within(repoLists[1]!).getByText('second')).toBeInTheDocument();
    });

    it('does not toggle expansion when a button inside the row is clicked', async () => {
      const second: ScmInstallation = {
        ...makeInstallation({initiallyExpanded: false}),
        integration: OrganizationIntegrationsFixture({id: '2', name: '@second-org'}),
        repositories: [makeRepo('10', 'second/repo')],
      };

      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[
            makeInstallation({onUninstall: jest.fn()}),
            {...second, onUninstall: jest.fn()},
          ]}
        />
      );

      expect(screen.queryByText('second/repo')).not.toBeInTheDocument();

      // Clicking the Uninstall button inside the row should not expand it.
      await userEvent.click(screen.getAllByRole('button', {name: 'Uninstall'})[1]!);

      expect(screen.queryByText('second/repo')).not.toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    it('shows an empty-state message when there are no repos', () => {
      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[
            makeInstallation({repositories: [], manageUrl: 'https://github.com/'}),
          ]}
        />
      );

      expect(screen.getByText('No repositories available.')).toBeInTheDocument();
    });

    it('shows a loading indicator on the tag and loading text in the body when reposLoading', () => {
      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[makeInstallation({repositories: [], reposLoading: true})]}
        />
      );

      // Tag shows the count with a loading indicator icon.
      expect(screen.getByText('0 repositories')).toBeInTheDocument();
      // Body shows loading text when no repos have arrived yet.
      const repoList = screen.getByRole('list', {name: 'Repositories'});
      expect(within(repoList).getByText('Loading repositories')).toBeInTheDocument();
    });

    it('hides repos that do not match repoMatches', () => {
      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[makeInstallation()]}
          repoMatches={{
            // Only 'cobra' matches.
            '2': [{key: 'name', value: 'org/cobra', indices: [[4, 8]]}],
          }}
        />
      );

      const repoList = screen.getByRole('list', {name: 'Repositories'});
      expect(within(repoList).getByText('cobra')).toBeInTheDocument();
      expect(within(repoList).getAllByRole('listitem')).toHaveLength(1);
    });

    it('shows a no-matches message when search filters out all repos', () => {
      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[makeInstallation()]}
          repoMatches={{}}
        />
      );

      const repoList = screen.getByRole('list', {name: 'Repositories'});
      expect(
        within(repoList).getByText('No repositories match your search')
      ).toBeInTheDocument();
    });
  });

  describe('repository count tag', () => {
    it('shows last-synced date in the tooltip when configData has last_sync', async () => {
      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[
            makeInstallation({
              integration: OrganizationIntegrationsFixture({
                id: '1',
                configData: {
                  last_sync: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                },
              }),
            }),
          ]}
        />
      );

      await userEvent.hover(screen.getByText('3 repositories'));
      expect(await screen.findByText(/Repositories last synced/)).toBeInTheDocument();
    });

    it('shows "not synced yet" in the tooltip when lastSync is absent', async () => {
      render(
        <ScmRepositoryTable provider={provider} installations={[makeInstallation()]} />
      );

      await userEvent.hover(screen.getByText('3 repositories'));
      expect(await screen.findByText('Repositories not yet synced.')).toBeInTheDocument();
    });

    it('renders the sync button via onSync when Sync now is clicked', async () => {
      const onSync = jest.fn();
      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[makeInstallation({onSync})]}
        />
      );

      await userEvent.hover(screen.getByText('3 repositories'));
      await userEvent.click(await screen.findByRole('button', {name: 'Sync now'}));
      expect(onSync).toHaveBeenCalledTimes(1);
    });

    it('hides the sync button when onSync is not provided', async () => {
      render(
        <ScmRepositoryTable provider={provider} installations={[makeInstallation()]} />
      );

      await userEvent.hover(screen.getByText('3 repositories'));
      await screen.findByText('Repositories not yet synced.');
      expect(screen.queryByRole('button', {name: 'Sync now'})).not.toBeInTheDocument();
    });
  });

  describe('installationWrapper', () => {
    it('injects overrides via InstallationOverrideProvider', async () => {
      const onSync = jest.fn();

      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[makeInstallation()]}
          installationWrapper={({children}) => (
            <InstallationOverrideProvider value={{isSyncing: false, onSync}}>
              {children}
            </InstallationOverrideProvider>
          )}
        />
      );

      await userEvent.hover(screen.getByText('3 repositories'));
      await userEvent.click(await screen.findByRole('button', {name: 'Sync now'}));
      expect(onSync).toHaveBeenCalledTimes(1);
    });

    it('shows syncing state when isSyncing override is true', async () => {
      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[makeInstallation()]}
          installationWrapper={({children}) => (
            <InstallationOverrideProvider value={{isSyncing: true}}>
              {children}
            </InstallationOverrideProvider>
          )}
        />
      );

      await userEvent.hover(screen.getByText('3 repositories'));
      expect(
        await screen.findByText('Re-syncing in the background…')
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Sync now'})).not.toBeInTheDocument();
    });
  });

  describe('project mappings', () => {
    it('sorts mapped repos before unmapped, alphabetically within each group', async () => {
      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[
            makeInstallation({
              mappedProjectSlugsByRepoId: {
                // `cobra` (id=2) is mapped — should appear first even though
                // alphabetically it comes after aardvark/badger.
                '2': ['frontend'],
              },
            }),
          ]}
        />
      );

      // Wait for async ProjectList resolution before reading order.
      await screen.findByTestId('platform-icon-javascript');
      const repoList = screen.getByRole('list', {name: 'Repositories'});
      const rows = within(repoList)
        .getAllByRole('listitem')
        .map(el => el.textContent?.trim());
      expect(rows[0]).toContain('org/cobra');
      expect(rows[1]).toContain('org/aardvark');
      expect(rows[2]).toContain('org/badger');
    });

    it('shows a placeholder for repos without slugs while mappings load', () => {
      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[
            makeInstallation({
              mappedProjectSlugsByRepoId: {'1': ['frontend']},
              mappingsLoading: true,
            }),
          ]}
        />
      );

      // Two of three rows have no slugs yet → two placeholders.
      expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(2);
    });

    it('omits the placeholder once mappings finish loading', () => {
      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[
            makeInstallation({
              mappedProjectSlugsByRepoId: {'1': ['frontend']},
              mappingsLoading: false,
            }),
          ]}
        />
      );

      expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
    });

    it('renders repoActions for every row when mapping data is provided', () => {
      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[
            makeInstallation({
              mappedProjectSlugsByRepoId: {},
              repoActions: () => <button aria-label="Project mappings" />,
            }),
          ]}
        />
      );

      expect(screen.getAllByRole('button', {name: 'Project mappings'})).toHaveLength(3);
    });

    it('does not render repoActions when mapping data is not provided', () => {
      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[
            makeInstallation({
              repoActions: () => <button aria-label="Project mappings" />,
            }),
          ]}
        />
      );

      expect(
        screen.queryByRole('button', {name: 'Project mappings'})
      ).not.toBeInTheDocument();
    });

    it('renders project platform icons for mapped repos', async () => {
      render(
        <ScmRepositoryTable
          provider={provider}
          installations={[
            makeInstallation({
              mappedProjectSlugsByRepoId: {'1': ['frontend', 'backend']},
            }),
          ]}
        />
      );

      // `frontend` → javascript platform; `backend` → python platform.
      expect(await screen.findByTestId('platform-icon-javascript')).toBeInTheDocument();
      expect(await screen.findByTestId('platform-icon-python')).toBeInTheDocument();
    });
  });
});

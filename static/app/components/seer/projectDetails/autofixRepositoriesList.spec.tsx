import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import type {SeerProjectReposResponse} from 'sentry/utils/seer/types';

import {AutofixRepositoriesList} from './autofixRepositoriesList';

// jsdom has no layout, so the virtualizer would render zero rows in the repo modal.
jest.mock('@tanstack/react-virtual', () => ({
  ...jest.requireActual('@tanstack/react-virtual'),
  useVirtualizer: ({count}: {count: number}) => ({
    getVirtualItems: () =>
      Array.from({length: count}, (_, index) => ({
        key: index,
        index,
        start: index * 36,
        end: (index + 1) * 36,
        size: 36,
        lane: 0,
      })),
    getTotalSize: () => count * 36,
    measure: () => {},
    measureElement: () => {},
  }),
}));

describe('AutofixRepositoriesList', () => {
  const project = ProjectFixture();
  const tokenBilledOrganization = OrganizationFixture({
    features: ['seer-token-based-billing-onboarding', 'token-billed-seer-enabled'],
  });
  const seatBilledOrganization = OrganizationFixture();

  const repo: SeerProjectReposResponse = {
    id: '1',
    repositoryId: '1',
    branchName: '',
    branchOverrides: [],
    instructions: '',
    externalId: '101',
    integrationId: '201',
    name: 'sentry',
    organizationId: '',
    owner: 'getsentry',
    provider: 'integrations:github',
  };

  function mockRepos(slug: string, repos: SeerProjectReposResponse[]) {
    MockApiClient.addMockResponse({
      url: `/projects/${slug}/${project.slug}/seer/repos/`,
      method: 'GET',
      body: repos,
    });
  }

  const eightRepos = Array.from({length: 8}, (_, i) => ({
    ...repo,
    id: `${i + 1}`,
    repositoryId: `${i + 1}`,
    externalId: `${101 + i}`,
    name: `repo-${i + 1}`,
  }));

  function mockUnlinkedOrgRepo(slug: string) {
    MockApiClient.addMockResponse({
      url: `/organizations/${slug}/repos/`,
      method: 'GET',
      body: [
        RepositoryFixture({
          id: '99',
          externalId: '999',
          name: 'getsentry/relay',
          provider: {id: 'integrations:github', name: 'GitHub'},
        }),
      ],
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('token-billed org', () => {
    it('lists linked repos without a remove action', async () => {
      mockRepos(tokenBilledOrganization.slug, [repo]);

      render(
        <AutofixRepositoriesList
          canWrite
          includeInstructions={false}
          project={project}
        />,
        {organization: tokenBilledOrganization}
      );

      expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
      expect(screen.getByText('Linked Repositories')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Link Repositories'})).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Disconnect Repository'})
      ).not.toBeInTheDocument();
    });

    it('asks to link a repo when the project has none', async () => {
      mockRepos(tokenBilledOrganization.slug, []);

      render(
        <AutofixRepositoriesList
          canWrite
          includeInstructions={false}
          project={project}
        />,
        {organization: tokenBilledOrganization}
      );

      expect(await screen.findByText('Link a repository')).toBeInTheDocument();
      expect(
        screen.getByText('Link a repository to this project so Seer can read your code.')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Link Repositories'})).toBeInTheDocument();
    });

    it('links another repo when the project has 8', async () => {
      mockRepos(tokenBilledOrganization.slug, eightRepos);
      mockUnlinkedOrgRepo(tokenBilledOrganization.slug);
      const addRequest = MockApiClient.addMockResponse({
        url: `/projects/${tokenBilledOrganization.slug}/${project.slug}/seer/repos/`,
        method: 'POST',
        body: {},
      });

      render(
        <AutofixRepositoriesList
          canWrite
          includeInstructions={false}
          project={project}
        />,
        {organization: tokenBilledOrganization}
      );
      renderGlobalModal({organization: tokenBilledOrganization});

      await userEvent.click(
        await screen.findByRole('button', {name: 'Link Repositories'})
      );
      await userEvent.click(await screen.findByText('getsentry/relay'));
      await userEvent.click(screen.getByRole('button', {name: 'Add 1 Repository'}));

      expect(addRequest).toHaveBeenCalled();
    });
  });

  describe('seat-billed org', () => {
    it('says the project is at the repo limit when it has 8', async () => {
      mockRepos(seatBilledOrganization.slug, eightRepos);
      mockUnlinkedOrgRepo(seatBilledOrganization.slug);

      render(
        <AutofixRepositoriesList
          canWrite
          includeInstructions={false}
          project={project}
        />,
        {organization: seatBilledOrganization}
      );
      renderGlobalModal();

      await userEvent.click(
        await screen.findByRole('button', {name: 'Add Repositories to Project'})
      );
      expect(
        await screen.findByText('Seer is currently limited to 8 repositories.')
      ).toBeInTheDocument();

      await userEvent.click(await screen.findByText('getsentry/relay'));
      expect(screen.getByRole('button', {name: 'Done'})).toBeInTheDocument();
    });

    it('removes a repo after confirming', async () => {
      mockRepos(seatBilledOrganization.slug, [repo]);
      const deleteRequest = MockApiClient.addMockResponse({
        url: `/projects/${seatBilledOrganization.slug}/${project.slug}/seer/repos/${repo.repositoryId}/`,
        method: 'DELETE',
        body: {},
      });

      render(
        <AutofixRepositoriesList
          canWrite
          includeInstructions={false}
          project={project}
        />,
        {organization: seatBilledOrganization}
      );
      renderGlobalModal();

      expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
      expect(screen.getByText('Connected Repositories')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Add Repositories to Project'})
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Disconnect Repository'}));
      await userEvent.click(await screen.findByText('Disconnect'));

      expect(deleteRequest).toHaveBeenCalled();
    });

    it('asks to connect a repo when the project has none', async () => {
      mockRepos(seatBilledOrganization.slug, []);

      render(
        <AutofixRepositoriesList
          canWrite
          includeInstructions={false}
          project={project}
        />,
        {organization: seatBilledOrganization}
      );

      expect(await screen.findByText('Connect a repository')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Add Repositories to Project'})
      ).toBeInTheDocument();
    });
  });
});

import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import type {SeerProjectReposResponse} from 'sentry/utils/seer/types';

import {AutofixRepositoriesList} from './autofixRepositoriesList';

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
  });

  describe('seat-billed org', () => {
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

import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import RepositoryStore from 'sentry/stores/repositoryStore';
import IntegrationRepos from 'sentry/views/settings/organizationIntegrations/integrationRepos';

describe('IntegrationRepos', function () {
  const org = OrganizationFixture();
  const integration = GitHubIntegrationFixture();
  let resetReposSpy: jest.SpyInstance;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    RepositoryStore.init();
    resetReposSpy = jest.spyOn(RepositoryStore, 'resetRepositories');
  });

  afterEach(() => {
    resetReposSpy.mockClear();
  });

  describe('Getting repositories', function () {
    it('handles broken integrations', async function () {
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/integrations/1/repos/`,
        statusCode: 400,
        body: {detail: 'Invalid grant'},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'GET',
        body: [],
      });

      render(<IntegrationRepos integration={integration} />);
      await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
      // we only attempt to fetch repositories upon typing
      await userEvent.click(screen.getByText('Add Repository'));
      await userEvent.type(screen.getByRole('textbox'), 'asdf');

      expect(
        await screen.findByText(
          /We were unable to fetch repositories for this integration/
        )
      ).toBeInTheDocument();
    });

    it('does not fetch repositories with empty query', async function () {
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'GET',
        body: [],
      });

      render(<IntegrationRepos integration={integration} />);
      await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
      await userEvent.click(screen.getByText('Add Repository'));

      expect(
        await screen.findByText(/Please enter a repository name/)
      ).toBeInTheDocument();
    });
  });

  describe('Adding repositories', function () {
    it('can save successfully', async function () {
      const addRepo = MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'POST',
        body: RepositoryFixture({integrationId: '1'}),
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/integrations/1/repos/`,
        body: {
          repos: [{identifier: 'example/repo-name', name: 'repo-name'}],
        },
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'GET',
        body: [],
      });

      render(<IntegrationRepos integration={integration} />);
      await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
      await userEvent.click(screen.getByText('Add Repository'));
      await userEvent.type(screen.getByRole('textbox'), 'repo-name');
      await userEvent.click(screen.getByText('repo-name'));

      expect(addRepo).toHaveBeenCalledWith(
        `/organizations/${org.slug}/repos/`,
        expect.objectContaining({
          data: {
            installation: '1',
            provider: 'integrations:github',
            identifier: 'example/repo-name',
          },
        })
      );

      expect(await screen.findByText('example/repo-name')).toBeInTheDocument();
      expect(resetReposSpy).toHaveBeenCalled();
    });

    it('handles failure during save', async function () {
      const addRepo = MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'POST',
        statusCode: 400,
        body: {
          errors: {
            __all__: 'Repository already exists.',
          },
        },
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/integrations/1/repos/`,
        body: {
          repos: [{identifier: 'getsentry/sentry', name: 'sentry-repo'}],
        },
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'GET',
        body: [],
      });

      render(<IntegrationRepos integration={integration} />);
      await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
      await userEvent.click(screen.getByText('Add Repository'));
      await userEvent.type(screen.getByRole('textbox'), 'sentry-repo');
      await userEvent.click(screen.getByText('sentry-repo'));

      expect(addRepo).toHaveBeenCalled();
      expect(screen.queryByText('getsentry/sentry')).not.toBeInTheDocument();
    });

    it('does not disable add repo for members', async function () {
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/integrations/1/repos/`,
        body: {
          repos: [{identifier: 'example/repo-name', name: 'repo-name'}],
        },
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'GET',
        body: [],
      });

      render(<IntegrationRepos integration={integration} />);
      await waitFor(() => expect(screen.getByText('Add Repository')).toBeEnabled());
    });
  });

  describe('migratable repo', function () {
    it('associates repository with integration', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        body: [
          RepositoryFixture({
            integrationId: undefined,
            externalSlug: 'example/repo-name',
            provider: {
              id: 'integrations:github',
              name: 'GitHub',
            },
          }),
        ],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'POST',
        body: RepositoryFixture({integrationId: '1'}),
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/integrations/${integration.id}/repos/`,
        body: {repos: [{identifier: 'example/repo-name', name: 'repo-name'}]},
      });
      const updateRepo = MockApiClient.addMockResponse({
        method: 'PUT',
        url: `/organizations/${org.slug}/repos/4/`,
        body: {id: 244},
      });
      render(<IntegrationRepos integration={integration} />);
      await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
      await userEvent.click(screen.getByText('Add Repository'));
      await userEvent.type(screen.getByRole('textbox'), 'repo-name');
      await userEvent.click(screen.getByText('repo-name'));
      expect(updateRepo).toHaveBeenCalledWith(
        `/organizations/${org.slug}/repos/4/`,
        expect.objectContaining({
          data: {integrationId: '1'},
        })
      );
      await waitFor(() => expect(resetReposSpy).toHaveBeenCalled());
    });

    it('uses externalSlug not name for comparison', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'GET',
        body: [RepositoryFixture({name: 'repo-name-other', externalSlug: '9876'})],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'POST',
        body: RepositoryFixture({integrationId: '1'}),
      });
      const getItems = MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/integrations/${integration.id}/repos/`,
        method: 'GET',
        body: {
          repos: [{identifier: '9876', name: 'repo-name'}],
        },
      });
      const updateRepo = MockApiClient.addMockResponse({
        method: 'PUT',
        url: `/organizations/${org.slug}/repos/4/`,
        body: {id: 4320},
      });
      render(<IntegrationRepos integration={integration} />);
      await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
      await userEvent.click(screen.getByText('Add Repository'));
      await userEvent.type(screen.getByRole('textbox'), 'repo-name');
      await userEvent.click(screen.getByText('repo-name'));

      expect(getItems).toHaveBeenCalled();
      expect(updateRepo).toHaveBeenCalledWith(
        `/organizations/${org.slug}/repos/4/`,
        expect.objectContaining({
          data: {integrationId: '1'},
        })
      );
    });
  });
});

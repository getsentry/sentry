import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import RepositoryStore from 'sentry/stores/repositoryStore';
import IntegrationRepos from 'sentry/views/organizationIntegrations/integrationRepos';

describe('IntegrationRepos', function () {
  const org = TestStubs.Organization();
  const integration = TestStubs.GitHubIntegration();
  let resetReposSpy;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    RepositoryStore.init();
    resetReposSpy = jest.spyOn(RepositoryStore, 'resetRepositories');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetReposSpy();
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
      expect(
        await screen.findByText(
          /We were unable to fetch repositories for this integration/
        )
      ).toBeInTheDocument();
    });
  });

  describe('Adding repositories', function () {
    it('can save successfully', async function () {
      const addRepo = MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'POST',
        body: TestStubs.Repository({integrationId: '1'}),
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
      userEvent.click(screen.getByText('Add Repository'));
      userEvent.click(screen.getByText('repo-name'));

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

    it('handles failure during save', function () {
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
      userEvent.click(screen.getByText('Add Repository'));
      userEvent.click(screen.getByText('sentry-repo'));

      expect(addRepo).toHaveBeenCalled();
      expect(screen.queryByText('getsentry/sentry')).not.toBeInTheDocument();
    });

    it('does not disable add repo for members', function () {
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

      render(
        <IntegrationRepos
          integration={integration}
          organization={TestStubs.Organization({access: []})}
        />
      );
      expect(screen.getByText('Add Repository')).toBeEnabled();
    });
  });

  describe('migratable repo', function () {
    it('associates repository with integration', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        body: [
          TestStubs.Repository({
            integrationId: null,
            externalSlug: 'example/repo-name',
            provider: {
              id: 'integrations:github',
              name: 'GitHub',
              status: 'active',
            },
          }),
        ],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/integrations/${integration.id}/repos/`,
        body: {repos: [{identifier: 'example/repo-name', name: 'repo-name'}]},
      });
      const updateRepo = MockApiClient.addMockResponse({
        method: 'PUT',
        url: `/organizations/${org.slug}/repos/4/`,
        body: {},
      });
      render(<IntegrationRepos integration={integration} />);

      userEvent.click(screen.getByText('Add Repository'));
      userEvent.click(screen.getByText('repo-name'));

      expect(updateRepo).toHaveBeenCalledWith(
        `/organizations/${org.slug}/repos/4/`,
        expect.objectContaining({
          data: {integrationId: '1'},
        })
      );
      await waitFor(() => expect(resetReposSpy).toHaveBeenCalled());
    });

    it('uses externalSlug not name for comparison', () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'GET',
        body: [TestStubs.Repository({name: 'repo-name', externalSlug: 9876})],
      });
      const getItems = MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/integrations/${integration.id}/repos/`,
        method: 'GET',
        body: {
          repos: [{identifier: 9876, name: 'repo-name'}],
        },
      });
      const updateRepo = MockApiClient.addMockResponse({
        method: 'PUT',
        url: `/organizations/${org.slug}/repos/4/`,
        body: {},
      });
      render(<IntegrationRepos integration={integration} />);

      userEvent.click(screen.getByText('Add Repository'));
      userEvent.click(screen.getByText('repo-name'));

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

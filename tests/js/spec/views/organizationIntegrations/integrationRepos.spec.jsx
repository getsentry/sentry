import {mountWithTheme} from 'sentry-test/enzyme';

import RepositoryActions from 'sentry/actions/repositoryActions';
import {Client} from 'sentry/api';
import IntegrationRepos from 'sentry/views/organizationIntegrations/integrationRepos';

describe('IntegrationRepos', function () {
  const org = TestStubs.Organization();
  const integration = TestStubs.GitHubIntegration();

  beforeEach(() => {
    Client.clearMockResponses();
    jest.spyOn(RepositoryActions, 'resetRepositories');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Getting repositories', function () {
    it('handles broken integrations', function () {
      Client.addMockResponse({
        url: `/organizations/${org.slug}/integrations/1/repos/`,
        statusCode: 400,
        body: {detail: 'Invalid grant'},
      });
      Client.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'GET',
        body: [],
      });

      const wrapper = mountWithTheme(<IntegrationRepos integration={integration} />);
      expect(wrapper.find('PanelBody')).toHaveLength(0);
      expect(wrapper.find('Alert')).toHaveLength(1);
    });
  });

  describe('Adding repositories', function () {
    it('can save successfully', async function () {
      const addRepo = Client.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'POST',
        body: TestStubs.Repository({integrationId: '1'}),
      });
      Client.addMockResponse({
        url: `/organizations/${org.slug}/integrations/1/repos/`,
        body: {
          repos: [{identifier: 'example/repo-name', name: 'repo-name'}],
        },
      });
      Client.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'GET',
        body: [],
      });

      const wrapper = mountWithTheme(<IntegrationRepos integration={integration} />);
      wrapper.find('DropdownButton').simulate('click');

      wrapper.find('StyledListElement').simulate('click');
      await wrapper.update();
      await wrapper.update();

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
      const name = wrapper.find('RepositoryRow').find('strong').first();
      expect(name).toHaveLength(1);
      expect(name.text()).toEqual('example/repo-name');

      expect(RepositoryActions.resetRepositories).toHaveBeenCalled();
    });

    it('handles failure during save', async function () {
      const addRepo = Client.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'POST',
        statusCode: 400,
        body: {
          errors: {
            __all__: 'Repository already exists.',
          },
        },
      });
      Client.addMockResponse({
        url: `/organizations/${org.slug}/integrations/1/repos/`,
        body: {
          repos: [{identifier: 'getsentry/sentry', name: 'sentry'}],
        },
      });
      Client.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'GET',
        body: [],
      });

      const wrapper = mountWithTheme(<IntegrationRepos integration={integration} />);
      wrapper.find('DropdownButton').simulate('click');
      wrapper.find('StyledListElement').simulate('click');
      await wrapper.update();

      expect(addRepo).toHaveBeenCalled();
      expect(wrapper.find('RepoOption')).toHaveLength(0);
    });
  });

  describe('migratable repo', function () {
    it('associates repository with integration', async () => {
      Client.addMockResponse({
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
      Client.addMockResponse({
        url: `/organizations/${org.slug}/integrations/${integration.id}/repos/`,
        body: {repos: [{identifier: 'example/repo-name', name: 'repo-name'}]},
      });
      const updateRepo = Client.addMockResponse({
        method: 'PUT',
        url: `/organizations/${org.slug}/repos/4/`,
        body: {},
      });
      const wrapper = mountWithTheme(<IntegrationRepos integration={integration} />);

      wrapper.find('DropdownButton').simulate('click');
      wrapper.find('StyledListElement').simulate('click');
      await tick();

      expect(updateRepo).toHaveBeenCalledWith(
        `/organizations/${org.slug}/repos/4/`,
        expect.objectContaining({
          data: {integrationId: '1'},
        })
      );
      expect(RepositoryActions.resetRepositories).toHaveBeenCalled();
    });

    it('uses externalSlug not name for comparison', () => {
      Client.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'GET',
        body: [TestStubs.Repository({name: 'repo-name', externalSlug: 9876})],
      });
      const getItems = Client.addMockResponse({
        url: `/organizations/${org.slug}/integrations/${integration.id}/repos/`,
        method: 'GET',
        body: {
          repos: [{identifier: 9876, name: 'repo-name'}],
        },
      });
      const updateRepo = Client.addMockResponse({
        method: 'PUT',
        url: `/organizations/${org.slug}/repos/4/`,
        body: {},
      });
      const wrapper = mountWithTheme(<IntegrationRepos integration={integration} />);
      wrapper.find('DropdownButton').simulate('click');
      wrapper.find('StyledListElement').simulate('click');

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

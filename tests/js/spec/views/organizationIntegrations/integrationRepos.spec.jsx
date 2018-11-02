/*global global*/
import React from 'react';

import {Client} from 'app/api';
import {mount} from 'enzyme';
import IntegrationRepos from 'app/views/organizationIntegrations/integrationRepos';

describe('IntegrationRepos', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  describe('Adding repositories', function() {
    const org = TestStubs.Organization();
    const integration = TestStubs.GitHubIntegration();
    const routerContext = TestStubs.routerContext();

    describe('successful save', async function() {
      let addRepo = Client.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        method: 'POST',
        body: {
          id: 9,
          integrationId: '1',
          name: 'getsentry/sentry',
          url: 'https://github.com/getsentry/sentry',
          provider: {
            name: 'GitHub',
            id: 'integrations:github',
            status: 'active',
            url: 'github.com/getsentry',
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

      const wrapper = mount(
        <IntegrationRepos integration={integration} />,
        routerContext
      );
      wrapper.find('DropdownButton').simulate('click');
      wrapper.find('StyledListElement').simulate('click');
      await wrapper.update();

      expect(addRepo).toHaveBeenCalledWith(
        `/organizations/${org.slug}/repos/`,
        expect.objectContaining({
          data: {
            installation: '1',
            provider: 'integrations:github',
            identifier: 'getsentry/sentry',
          },
        })
      );
      let repoRow = wrapper.find('RepoOption').first();
      expect(repoRow.find('strong').text()).toEqual('getsentry/sentry');
    });

    describe('save failure', async function() {
      let addRepo = Client.addMockResponse({
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

      const wrapper = mount(
        <IntegrationRepos integration={integration} />,
        routerContext
      );
      wrapper.find('DropdownButton').simulate('click');
      wrapper.find('StyledListElement').simulate('click');
      await wrapper.update();

      expect(addRepo).toHaveBeenCalled();
      expect(wrapper.find('RepoOption')).toHaveLength(0);
    });

    describe('migratable repo', function() {
      Client.addMockResponse({
        url: `/organizations/${org.slug}/repos/`,
        body: [
          {
            name: 'foo/bar',
            id: 2,
            integrationId: null,
            provider: {
              name: 'GitHub',
              id: 'integrations:github',
              status: 'active',
              url: 'github.com/foo/bar',
            },
          },
        ],
      });
      Client.addMockResponse({
        url: `/organizations/${org.slug}/integrations/${integration.id}/repos/`,
        body: {repos: [{identifier: 'foo/bar', name: 'foo'}]},
      });
      const wrapper = mount(
        <IntegrationRepos integration={integration} />,
        routerContext
      );

      it('associates repository with integration', () => {
        const updateRepo = Client.addMockResponse({
          method: 'PUT',
          url: `/organizations/${org.slug}/repos/${2}/`,
          body: {},
        });
        wrapper.find('DropdownButton').simulate('click');
        wrapper.find('StyledListElement').simulate('click');
        expect(updateRepo).toHaveBeenCalledWith(
          `/organizations/${org.slug}/repos/${2}/`,
          expect.objectContaining({
            data: {integrationId: '1'},
          })
        );
      });
    });
  });
});

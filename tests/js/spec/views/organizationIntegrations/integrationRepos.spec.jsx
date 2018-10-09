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

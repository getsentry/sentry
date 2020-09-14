import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import OrganizationApiKeys from 'app/views/settings/organizationApiKeys';

const routes = [
  {path: '/'},
  {path: '/:orgId/'},
  {path: '/organizations/:orgId/'},
  {path: 'api-keys/', name: 'API Key'},
];

describe('OrganizationApiKeys', function() {
  const routerContext = TestStubs.routerContext();

  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/organizations/org-slug/api-keys/',
      method: 'GET',
      body: [TestStubs.ApiKey()],
    });
    Client.addMockResponse({
      url: '/organizations/org-slug/api-keys/1/',
      method: 'GET',
      body: TestStubs.ApiKey(),
    });
    Client.addMockResponse({
      url: '/organizations/org-slug/api-keys/1/',
      method: 'DELETE',
    });
  });

  it('fetches api keys', function() {
    const wrapper = mountWithTheme(
      <OrganizationApiKeys
        location={TestStubs.location()}
        params={{orgId: 'org-slug'}}
        routes={routes}
      />,
      routerContext
    );

    expect(wrapper.state('keys')).toEqual([TestStubs.ApiKey()]);
  });

  it('can delete a key', function() {
    const wrapper = mountWithTheme(
      <OrganizationApiKeys
        location={TestStubs.location()}
        params={{orgId: 'org-slug'}}
        routes={routes}
      />,
      routerContext
    );
    // OrganizationApiKeys.handleRemove = jest.fn();
    // expect(OrganizationApiKeys.handleRemove).not.toHaveBeenCalled();

    wrapper.instance().handleRemove(1);

    expect(wrapper.state('keys')).toEqual([]);
  });
});

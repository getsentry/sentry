import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import OrganizationApiKeysView from 'app/views/settings/organization/apiKeys/organizationApiKeysView';

const routes = [
  {path: '/'},
  {path: '/:orgId/'},
  {path: '/organizations/:orgId/'},
  {path: 'api-keys/', name: 'API Key'},
];

describe('OrganizationApiKeysView', function() {
  let routerContext = TestStubs.routerContext();

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
    let wrapper = mount(
      <OrganizationApiKeysView
        location={TestStubs.location()}
        params={{orgId: 'org-slug'}}
        routes={routes}
      />,
      routerContext
    );

    expect(wrapper.state('keys')).toEqual([TestStubs.ApiKey()]);
  });

  it('can delete a key', function() {
    let wrapper = mount(
      <OrganizationApiKeysView
        location={TestStubs.location()}
        params={{orgId: 'org-slug'}}
        routes={routes}
      />,
      routerContext
    );
    // OrganizationApiKeysView.handleRemove = jest.fn();
    // expect(OrganizationApiKeysView.handleRemove).not.toHaveBeenCalled();

    wrapper.instance().handleRemove(1);

    expect(wrapper.state('keys')).toEqual([]);
  });
});

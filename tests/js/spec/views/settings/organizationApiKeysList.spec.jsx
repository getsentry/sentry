import React from 'react';
import {mount} from 'enzyme';

import OrganizationApiKeysList from 'app/views/settings/organizationApiKeys/organizationApiKeysList';

jest.unmock('app/utils/recreateRoute');

const routes = [
  {path: '/'},
  {path: '/:orgId/'},
  {path: '/organizations/:orgId/'},
  {path: 'api-keys/', name: 'API Key'},
];

describe('OrganizationApiKeysList', function() {
  beforeEach(function() {});

  it('renders', function() {
    let wrapper = mount(
      <OrganizationApiKeysList
        params={{orgId: 'org-slug'}}
        routes={routes}
        keys={[TestStubs.ApiKey()]}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('opens a modal when trying to delete a key', function() {
    let wrapper = mount(
      <OrganizationApiKeysList
        params={{orgId: 'org-slug'}}
        routes={routes}
        keys={[TestStubs.ApiKey()]}
      />,
      TestStubs.routerContext()
    );

    wrapper.update();
    // Click remove button
    wrapper.find('.icon-trash').simulate('click');
    wrapper.update();

    // expect a modal
    let modal = wrapper.find('Modal');
    expect(modal.first().prop('show')).toBe(true);
  });
});

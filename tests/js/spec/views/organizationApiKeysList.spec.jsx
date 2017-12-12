import React from 'react';
import {mount} from 'enzyme';

import OrganizationApiKeysList from 'app/views/settings/organization/apiKeys/organizationApiKeysList';

const childContextTypes = {
  organization: React.PropTypes.object,
  router: React.PropTypes.object,
  location: React.PropTypes.object,
};

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
      />
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
      {
        context: {
          router: TestStubs.router(),
          organization: TestStubs.Organization(),
          location: TestStubs.location(),
        },
        childContextTypes,
      }
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

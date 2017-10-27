import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import OrganizationApiKeysView from 'app/views/settings/organization/apiKeys/organizationApiKeysView';

const childContextTypes = {
  organization: React.PropTypes.object,
  router: React.PropTypes.object,
  location: React.PropTypes.object,
};

describe('OrganizationApiKeysView', function() {
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
  });

  it('renders', function() {
    let wrapper = mount(<OrganizationApiKeysView params={{orgId: 'org-slug'}} />, {
      context: {
        router: TestStubs.router(),
        organization: TestStubs.Organization(),
        location: TestStubs.location(),
      },
      childContextTypes,
    });
    expect(wrapper.state('loading')).toBe(false);
    expect(wrapper).toMatchSnapshot();
  });

  it('can delete a key', function() {
    let wrapper = mount(<OrganizationApiKeysView params={{orgId: 'org-slug'}} />, {
      context: {
        router: TestStubs.router(),
        organization: TestStubs.Organization(),
        location: TestStubs.location(),
      },
      childContextTypes,
    });
    OrganizationApiKeysView.handleRemove = jest.fn();
    expect(OrganizationApiKeysView.handleRemove).not.toHaveBeenCalled();

    // Click remove button
    wrapper.find('.icon-trash').simulate('click');
    wrapper.update();

    // expect a modal
    let modal = wrapper.find('Modal');
    expect(modal.first().prop('show')).toBe(true);

    // TODO
    // wrapper.find('Modal').last().find('Button').last().simulate('click');

    // expect(OrganizationApiKeysView.handleRemove).toHaveBeenCalled();
  });
});

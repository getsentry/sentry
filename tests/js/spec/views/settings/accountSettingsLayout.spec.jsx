import React from 'react';
import {mount} from 'enzyme';

import * as OrgActions from 'app/actionCreators/organizations';
import AccountSettingsLayout from 'app/views/settings/account/accountSettingsLayout';

describe('AccountSettingsLayout', function() {
  let wrapper;
  let spy;
  let api;

  let organization = {
    id: '44',
    name: 'Org Index',
    slug: 'org-index',
  };

  beforeEach(function() {
    spy = jest.spyOn(OrgActions, 'fetchOrganizationDetails');
    api = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
    });
    wrapper = mount(<AccountSettingsLayout params={{}} />, TestStubs.routerContext());
  });

  it('fetches org details for SidebarDropdown', function() {
    // org from index endpoint, no `access` info
    wrapper.setProps({organization});
    wrapper.update();

    expect(spy).toHaveBeenCalledWith(organization.slug, {
      setActive: true,
      loadProjects: true,
    });
    expect(api).toHaveBeenCalledTimes(1);
  });

  it('does not fetch org details for SidebarDropdown', function() {
    // org already has details
    wrapper.setProps({organization: TestStubs.Organization()});
    wrapper.update();

    expect(spy).not.toHaveBeenCalledWith();
    expect(api).not.toHaveBeenCalled();
  });
});

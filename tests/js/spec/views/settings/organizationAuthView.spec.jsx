import React from 'react';
import {shallow} from 'enzyme';

import {Client} from 'app/api';
import OrganizationAuthView from 'app/views/settings/organizationAuth/organizationAuthProvider';

describe('OrganizationAuthView', function() {
  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/organizations/org-slug/auth-provider/',
      method: 'GET',
      body: TestStubs.AuthProvider(),
    });
    Client.addMockResponse({
      url: '/organizations/org-slug/auth-providers/',
      method: 'GET',
      body: [TestStubs.AuthProvider()],
    });
  });

  it('renders from api', function() {
    let wrapper = shallow(<OrganizationAuthView orgId="org-slug" />);

    expect(wrapper).toMatchSnapshot();
  });
});

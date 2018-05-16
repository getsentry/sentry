import React from 'react';
import {shallow} from 'enzyme';

import OrganizationAuthList from 'app/views/settings/organizationAuth/organizationAuthList';

jest.mock('jquery');

describe('OrganizationAuthList', function() {
  it('renders with no providers', function() {
    let wrapper = shallow(
      <OrganizationAuthList providerList={[]} />,
      TestStubs.routerContext()
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('renders', function() {
    let wrapper = shallow(
      <OrganizationAuthList
        orgId="org-slug"
        onSendReminders={() => {}}
        providerList={TestStubs.AuthProviders()}
      />,
      TestStubs.routerContext()
    );

    expect(wrapper).toMatchSnapshot();
  });
});

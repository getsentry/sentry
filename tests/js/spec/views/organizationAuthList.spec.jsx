import React from 'react';
import {shallow} from 'enzyme';

import OrganizationAuthList
  from 'app/views/settings/organization/auth/organizationAuthList';

jest.mock('jquery');

describe('OrganizationAuthList', function() {
  it('renders with no providers', function() {
    let wrapper = shallow(<OrganizationAuthList providerList={[]} />);

    expect(wrapper).toMatchSnapshot();
  });

  it('renders', function() {
    let wrapper = shallow(
      <OrganizationAuthList
        orgId="org-slug"
        onSendReminders={() => {}}
        providerList={TestStubs.AuthProviders()}
      />
    );

    expect(wrapper).toMatchSnapshot();
  });
});

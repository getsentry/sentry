import React from 'react';
import {mount} from 'enzyme';

import OrganizationHealth from 'app/views/organizationHealth';

describe('OrganizationHealth', function() {
  it('updates projects', function() {
    let org = TestStubs.Organization();
    let wrapper = mount(<OrganizationHealth organization={org} />);

    expect(wrapper).toMatchSnapshot();
  });
});

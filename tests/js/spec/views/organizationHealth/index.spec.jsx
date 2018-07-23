import React from 'react';
import {mount} from 'enzyme';

import OrganizationHealth from 'app/views/organizationHealth';

describe('OrganizationHealth', function() {
  it('updates projects', function() {
    let wrapper = mount(<OrganizationHealth />);

    expect(wrapper).toMatchSnapshot();
  });
});

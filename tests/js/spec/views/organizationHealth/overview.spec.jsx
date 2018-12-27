import React from 'react';
import {mount} from 'enzyme';

import OrganizationHealthOverview from 'app/views/organizationHealth/overview';

describe('OrganizationHealthOverview', function() {
  it('renders', function() {
    let wrapper = mount(<OrganizationHealthOverview />);
    expect(wrapper).toMatchSnapshot();
  });
});

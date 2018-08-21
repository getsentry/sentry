import React from 'react';
import {mount} from 'enzyme';

import OrganizationHealthTransactions from 'app/views/organizationHealth/transactions';

describe('OrganizationHealthTransactions', function() {
  it('renders', function() {
    let wrapper = mount(<OrganizationHealthTransactions />);
    expect(wrapper).toMatchSnapshot();
  });
});

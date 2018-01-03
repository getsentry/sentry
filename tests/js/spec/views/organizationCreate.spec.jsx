import React from 'react';
import {shallow} from 'enzyme';

import OrganizationCreate from 'app/views/organizationCreate';

describe('OrganizationCreate', function() {
  describe('render()', function() {
    it('renders correctly', function() {
      let wrapper = shallow(<OrganizationCreate />, {
        context: {router: TestStubs.router()},
      });
      expect(wrapper).toMatchSnapshot();
    });
  });
});

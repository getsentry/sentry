import React from 'react';
import {shallow} from 'enzyme';

import TeamCreate from 'app/views/teamCreate';

describe('TeamCreate', function() {
  describe('render()', function() {
    it('renders correctly', function() {
      let wrapper = shallow(
        <TeamCreate
          params={{
            orgId: 'org'
          }}
        />,
        {
          context: {router: TestStubs.router()}
        }
      );
      expect(wrapper).toMatchSnapshot();
    });
  });
});

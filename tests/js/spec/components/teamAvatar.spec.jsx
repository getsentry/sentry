import React from 'react';
import {shallow} from 'enzyme';

import TeamAvatar from 'app/components/teamAvatar';

describe('TeamAvatar', function() {
  describe('render()', function() {
    it('renders', function() {
      let team = TestStubs.Team();
      let wrapper = shallow(<TeamAvatar team={team} />);
      expect(wrapper).toMatchSnapshot();
    });
  });
});

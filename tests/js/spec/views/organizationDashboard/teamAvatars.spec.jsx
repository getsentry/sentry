import React from 'react';
import {mount} from 'enzyme';

import TeamAvatars from 'app/views/organizationDashboard/teamAvatars';

describe('TeamAvatars', function() {
  describe('render()', function() {
    it('renders with user avatars', function() {
      const users = [TestStubs.User({id: '1'}), TestStubs.User({id: '2'})];

      const wrapper = mount(<TeamAvatars members={users} />);
      expect(wrapper.find('Avatar')).toHaveLength(2);
      expect(wrapper.find('CollapsedMembers')).toHaveLength(0);
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with collapsed avatar count if > 5 users', function() {
      const users = [
        TestStubs.User({id: '1'}),
        TestStubs.User({id: '2'}),
        TestStubs.User({id: '3'}),
        TestStubs.User({id: '4'}),
        TestStubs.User({id: '5'}),
        TestStubs.User({id: '6'}),
      ];

      const wrapper = mount(<TeamAvatars members={users} />);
      expect(wrapper.find('Avatar')).toHaveLength(5);
      expect(wrapper.find('CollapsedMembers')).toHaveLength(1);
      expect(wrapper).toMatchSnapshot();
    });
  });
});

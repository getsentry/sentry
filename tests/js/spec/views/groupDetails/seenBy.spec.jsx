import React from 'react';
import {shallow} from 'enzyme';

import GroupSeenBy from 'app/views/groupDetails/seenBy';
import ConfigStore from 'app/stores/configStore';

describe('GroupSeenBy', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();

    sandbox.stub(ConfigStore, 'get').returns([]);
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('render()', function() {
    it('should return null if seenBy is falsy', function() {
      let wrapper = shallow(<GroupSeenBy />, {
        context: {
          group: TestStubs.Group({seenBy: undefined}),
          project: TestStubs.Project(),
          team: TestStubs.Team(),
        },
      });
      expect(wrapper.children()).toHaveLength(0);
    });

    it('should return a list of each user that saw', function() {
      let wrapper = shallow(<GroupSeenBy />, {
        context: {
          group: TestStubs.Group({
            seenBy: [
              {id: '1', email: 'jane@example.com'},
              {id: '2', email: 'john@example.com'},
            ],
          }),
          project: TestStubs.Project(),
          team: TestStubs.Team(),
        },
      });

      expect(wrapper.find('EyeIcon')).toHaveLength(1);
      expect(wrapper.find('AvatarList')).toHaveLength(1);
      expect(wrapper.find('AvatarList').prop('users')).toHaveLength(2);
    });
  });
});

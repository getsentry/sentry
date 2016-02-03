import React from 'react';
import {shallow} from 'enzyme';

import GroupSeenBy from 'app/views/groupDetails/seenBy';
import ConfigStore from 'app/stores/configStore';

describe('OrganizationTeams', function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.sandbox.stub(ConfigStore, 'get').returns([]);
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('render()', function() {
    it('should return null if seenBy is falsy', function () {
      let wrapper = shallow(<GroupSeenBy/>, {
        context: {
          group: {id: '1337'},
          project: {id: '2448'},
          team: {id: '3559'}
        }
      });
      expect(wrapper.children()).to.have.length(0);
    });

    it('should return a list of each user that saw', function () {
      let wrapper = shallow(<GroupSeenBy/>, {
        context: {
          group: {
            id: '1337',
            seenBy: [
              {id: 1, email: 'jane@example.com'},
              {id: 2, email: 'john@example.com'}
            ]
          },
          project: {id: '2448'},
          team: {id: '3559'}
        }
      });

      expect(wrapper.find('li')).to.have.length(3); // +1 for "icon-eye"
    });
  });
});

import React from 'react';
import {mount} from 'enzyme';

import GroupSeenBy from 'app/views/groupDetails/seenBy';
import ConfigStore from 'app/stores/configStore';
import Gravatar from 'app/components/gravatar';


import stubContext from '../../../helpers/stubContext';
import stubReactComponent from '../../../helpers/stubReactComponent';

describe('OrganizationTeams', function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.sandbox.stub(ConfigStore, 'get').returns([]);
    stubReactComponent(this.sandbox, [Gravatar]);
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('render()', function() {
    it('should return null if seenBy is falsy', function () {
      let ContextStubbedGroupSeenBy = stubContext(GroupSeenBy, {
        group: {id: '1337'},
        project: {},
        team: {}
      });

      let wrapper = mount(<ContextStubbedGroupSeenBy/>);
      expect(wrapper.children()).to.have.length(0);
    });

    it('should return a list of each user that saw', function () {
      let ContextStubbedGroupSeenBy = stubContext(GroupSeenBy, {
        group: {
          id: '1337',
          seenBy: [
            {id: 1, email: 'jane@example.com'},
            {id: 2, email: 'john@example.com'}
          ]
        },
        project: {},
        team: {}
      });

      let wrapper = mount(<ContextStubbedGroupSeenBy/>);
      expect(wrapper.find('li')).to.have.length(3); // +1 for "icon-eye"
    });
  });
});

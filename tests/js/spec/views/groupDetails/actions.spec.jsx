import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';

import GroupActions from 'app/views/groupDetails/actions';
import ConfigStore from 'app/stores/configStore';

describe('GroupActions', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.sandbox.stub(ConfigStore, 'get').returns([]);
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('render()', function() {
    it('renders correctly', function() {
      let wrapper = shallow(<GroupActions />, {
        context: {
          group: {
            id: '1337',
            pluginActions: [],
            pluginIssues: []
          },
          organization: {
            id: '4660',
            slug: 'org'
          },
          project: {
            id: '2448',
            slug: 'project'
          },
          team: {
            id: '3559',
            slug: 'team'
          }
        }
      });
      expect(toJson(wrapper)).toMatchSnapshot();
    });
  });
});

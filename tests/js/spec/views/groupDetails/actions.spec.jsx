import React from 'react';
import {shallow} from 'enzyme';

import GroupActions from 'app/views/groupDetails/actions';
import ConfigStore from 'app/stores/configStore';

describe('GroupActions', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();

    sandbox.stub(ConfigStore, 'get').returns([]);
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('render()', function() {
    it('renders correctly', function() {
      let wrapper = shallow(<GroupActions />, {
        context: {
          group: TestStubs.Group({
            id: '1337',
            pluginActions: [],
            pluginIssues: [],
          }),
          organization: TestStubs.Organization({
            id: '4660',
            slug: 'org',
          }),
          project: TestStubs.ProjectDetails({
            id: '2448',
            name: 'project name',
            slug: 'project',
          }),
          team: TestStubs.Team({
            id: '3559',
            slug: 'team',
          }),
        },
      });
      expect(wrapper).toMatchSnapshot();
    });
  });
});

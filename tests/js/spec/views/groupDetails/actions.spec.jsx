import React from 'react';
import {shallow} from 'enzyme';

import GroupActions from 'app/views/groupDetails/shared/actions';
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
      const wrapper = shallow(
        <GroupActions
          group={TestStubs.Group({
            id: '1337',
            pluginActions: [],
            pluginIssues: [],
          })}
          project={TestStubs.ProjectDetails({
            id: '2448',
            name: 'project name',
            slug: 'project',
          })}
        />,
        {
          context: {
            organization: TestStubs.Organization({
              id: '4660',
              slug: 'org',
            }),
          },
        }
      );
      expect(wrapper).toMatchSnapshot();
    });
  });
});

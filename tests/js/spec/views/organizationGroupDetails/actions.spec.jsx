import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import GroupActions from 'app/views/organizationGroupDetails/actions';
import ConfigStore from 'app/stores/configStore';

describe('GroupActions', function() {
  beforeEach(function() {
    jest.spyOn(ConfigStore, 'get').mockImplementation(() => []);
  });

  afterEach(function() {});

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
          organization={TestStubs.Organization({
            id: '4660',
            slug: 'org',
          })}
        />
      );
      expect(wrapper).toMatchSnapshot();
    });
  });
});

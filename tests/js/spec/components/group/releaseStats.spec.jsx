import React from 'react';
import {mount} from 'enzyme';

import ConfigStore from 'app/stores/configStore';
import GroupReleaseStats from 'app/components/group/releaseStats';
import EnvironmentStore from 'app/stores/environmentStore';

describe('GroupReleaseStats', function() {
  let component;
  beforeEach(function() {
    // Set timezone for snapshot
    ConfigStore.loadInitialData({
      user: {
        options: {
          timezone: 'America/Los_Angeles',
        },
      },
    });

    component = mount(
      <GroupReleaseStats
        group={TestStubs.Group()}
        project={TestStubs.Project()}
        allEnvironments={TestStubs.Group()}
        location={TestStubs.location()}
      />,
      {
        context: {
          organization: TestStubs.Organization(),
        },
      }
    );
  });

  it('renders', function() {
    EnvironmentStore.loadInitialData(TestStubs.Environments());
    expect(component).toMatchSnapshot();
  });
});

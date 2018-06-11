import React from 'react';
import {mount} from 'enzyme';

import ConfigStore from 'app/stores/configStore';
import {GroupReleaseStats} from 'app/components/group/releaseStats';

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
        allEnvironments={TestStubs.Group()}
        environment={TestStubs.Environments()[0]}
        location={TestStubs.location()}
      />,
      {
        context: {
          organization: TestStubs.Organization(),
          project: TestStubs.Project(),
          group: TestStubs.Group(),
        },
      }
    );
  });

  it('renders', function() {
    expect(component).toMatchSnapshot();
  });
});

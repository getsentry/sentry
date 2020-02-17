import {mount} from 'sentry-test/enzyme';
import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import ConfigStore from 'app/stores/configStore';
import GroupReleaseStats from 'app/components/group/releaseStats';

describe('GroupReleaseStats', function() {
  const {organization, project, routerContext} = initializeOrg();

  beforeAll(function() {
    // Set timezone for snapshot
    ConfigStore.loadInitialData({
      user: {
        options: {
          timezone: 'America/Los_Angeles',
        },
      },
    });
  });

  const createWrapper = props =>
    mount(
      <GroupReleaseStats
        group={TestStubs.Group()}
        project={project}
        organization={organization}
        allEnvironments={TestStubs.Group()}
        environments={[]}
        {...props}
      />,
      routerContext
    );

  it('renders all environments', function() {
    const wrapper = createWrapper();
    expect(wrapper.find('[data-test-id="env-label"]').text()).toBe('All Environments');
    expect(wrapper.find('GroupReleaseChart')).toHaveLength(2);
    expect(wrapper.find('SeenInfo')).toHaveLength(2);
  });

  it('renders specific environments', function() {
    const wrapper = createWrapper({environments: TestStubs.Environments()});
    expect(wrapper.find('[data-test-id="env-label"]').text()).toBe('Production, Staging');
    expect(wrapper.find('GroupReleaseChart')).toHaveLength(2);
    expect(wrapper.find('SeenInfo')).toHaveLength(2);
  });
});

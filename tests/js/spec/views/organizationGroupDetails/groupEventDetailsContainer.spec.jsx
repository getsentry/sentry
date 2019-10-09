import React from 'react';
import {mount} from 'enzyme';

import OrganizationEnvironmentsStore from 'app/stores/organizationEnvironmentsStore';
import GroupEventDetailsContainer from 'app/views/organizationGroupDetails/groupEventDetailsContainer';

jest.mock('app/views/organizationGroupDetails/groupEventDetails', () => ({
  GroupEventDetails: () => <div>GroupEventDetails</div>,
}));

describe('groupEventDetailsContainer', () => {
  const org = TestStubs.Organization();
  const globalSelection = TestStubs.GlobalSelection();

  beforeEach(() => {
    OrganizationEnvironmentsStore.init();
  });

  it('fetches environments', async function() {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/environments/`,
      body: [{id: 'id', name: 'name'}],
    });
    const wrapper = mount(
      <GroupEventDetailsContainer
        api={new MockApiClient()}
        organization={org}
        selection={globalSelection}
      />
    );
    // should be in loading state
    expect(wrapper.find('LoadingIndicator').exists()).toBe(true);
    await tick();
    await tick();
    wrapper.update();
    // should be loaded
    expect(wrapper.find('LoadingIndicator').exists()).toBe(false);
    expect(wrapper.find('GroupEventDetails').exists()).toBe(true);

    // remounting will not rerender
    const wrapper2 = mount(
      <GroupEventDetailsContainer
        api={new MockApiClient()}
        organization={org}
        selection={globalSelection}
      />
    );
    expect(wrapper2.find('LoadingIndicator').exists()).toBe(false);
    expect(wrapper2.find('GroupEventDetails').exists()).toBe(true);
  });

  it('displays an error', async function() {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/environments/`,
      statusCode: 400,
    });
    const wrapper = mount(
      <GroupEventDetailsContainer
        api={new MockApiClient()}
        organization={org}
        selection={globalSelection}
      />
    );
    expect(wrapper.find('LoadingIndicator').exists()).toBe(true);
    await tick();
    await tick();
    wrapper.update();
    expect(wrapper.find('LoadingIndicator').exists()).toBe(false);
    expect(wrapper.find('LoadingError').exists()).toBe(true);
  });
});

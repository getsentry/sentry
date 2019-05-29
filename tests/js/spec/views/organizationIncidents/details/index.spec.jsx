import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {mount} from 'enzyme';
import IncidentDetails from 'app/views/organizationIncidents/details';

describe('IncidentDetails', function() {
  const mockIncident = TestStubs.Incident();
  const {organization, routerContext} = initializeOrg();

  let activitiesList;

  const createWrapper = props =>
    mount(
      <IncidentDetails
        params={{orgId: 'org-slug', incidentId: mockIncident.identifier}}
        {...props}
      />,
      routerContext
    );

  beforeAll(function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/123/',
      body: mockIncident,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/456/',
      statusCode: 404,
    });
    activitiesList = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/incidents/${
        mockIncident.identifier
      }/activity/`,
      body: [TestStubs.IncidentActivity()],
    });
  });

  afterAll(function() {
    MockApiClient.clearMockResponses();
  });

  beforeEach(function() {
    activitiesList.mockClear();
  });

  it('loads incident', async function() {
    const wrapper = createWrapper();
    expect(wrapper.find('IncidentTitle').text()).toBe('Loading');
    expect(wrapper.find('SubscribeButton').prop('disabled')).toBe(true);

    await tick();
    wrapper.update();

    expect(wrapper.find('IncidentTitle').text()).toBe('Too many Chrome errors');
    expect(
      wrapper
        .find('ItemValue')
        .at(1)
        .text()
    ).toBe('100');
    expect(
      wrapper
        .find('ItemValue')
        .at(2)
        .text()
    ).toBe('20');
  });

  it('handles invalid incident', async function() {
    const wrapper = createWrapper({params: {orgId: 'org-slug', incidentId: '456'}});
    await tick();
    wrapper.update();

    // Activity will also have a LoadingError
    expect(wrapper.find('LoadingError')).toHaveLength(2);
  });

  it('changes status to closed and fetches new activities', async function() {
    const updateStatus = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/123/',
      method: 'PUT',
      body: TestStubs.Incident({
        status: 2,
      }),
    });

    const wrapper = createWrapper();

    await tick();
    wrapper.update();

    expect(activitiesList).toHaveBeenCalledTimes(1);

    expect(wrapper.find('Status').text()).toBe('Open');
    wrapper.find('[data-test-id="status-dropdown"] DropdownButton').simulate('click');
    wrapper
      .find('[data-test-id="status-dropdown"] MenuItem a')
      .at(0)
      .simulate('click');

    await tick();

    expect(updateStatus).toHaveBeenCalledWith(
      '/organizations/org-slug/incidents/123/',
      expect.objectContaining({
        data: {status: 2},
      })
    );

    // Refresh activities list since status changes also creates an activity
    expect(activitiesList).toHaveBeenCalledTimes(2);
    expect(wrapper.find('Status').text()).toBe('Closed');
  });

  it('toggles subscribe status with Subscribe button', async function() {
    const wrapper = createWrapper();

    await tick();
    wrapper.update();

    const subscribe = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/123/subscriptions/',
      method: 'POST',
    });
    const unsubscribe = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/123/subscriptions/',
      method: 'DELETE',
    });

    // Should be subscribed, so button should show "Unsubscribe"
    expect(wrapper.find('SubscribeButton Content').text()).toBe('Unsubscribe');

    // Click to unsubscribe
    wrapper.find('SubscribeButton').simulate('click');
    expect(unsubscribe).toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(wrapper.find('SubscribeButton Content').text()).toBe('Subscribe');

    // Click again to re-subscribe
    wrapper.find('SubscribeButton').simulate('click');
    expect(subscribe).toHaveBeenCalled();
  });
});

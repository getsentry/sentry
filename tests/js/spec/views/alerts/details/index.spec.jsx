import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import IncidentDetails from 'app/views/alerts/details';
import ProjectsStore from 'app/stores/projectsStore';

describe('IncidentDetails', function () {
  const params = {orgId: 'org-slug', alertId: '123'};
  const {organization, project, routerContext} = initializeOrg({
    router: {
      params,
    },
  });
  const mockIncident = TestStubs.Incident({projects: [project.slug]});
  let activitiesList;

  const createWrapper = (props, routerCtx) =>
    mountWithTheme(
      <IncidentDetails params={params} organization={organization} {...props} />,
      routerCtx ?? routerContext
    );

  beforeAll(function () {
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/123/',
      body: mockIncident,
    });

    // For @mentions
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/123/stats/',
      body: TestStubs.IncidentStats(),
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/123/seen/',
      method: 'POST',
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/456/stats/',
      body: TestStubs.IncidentStats({totalEvents: 555, uniqueUsers: 12}),
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/456/',
      statusCode: 404,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/456/activity/',
      statusCode: 404,
    });
    activitiesList = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/incidents/${mockIncident.identifier}/activity/`,
      body: [TestStubs.IncidentActivity()],
    });
  });

  afterAll(function () {
    MockApiClient.clearMockResponses();
  });

  beforeEach(function () {
    activitiesList.mockClear();
  });

  it('loads incident', async function () {
    const wrapper = createWrapper();
    expect(wrapper.find('IncidentTitle').text()).toBe('Loading');
    expect(wrapper.find('SubscribeButton').prop('disabled')).toBe(true);

    await tick();
    wrapper.update();

    expect(wrapper.find('IncidentTitle').text()).toBe('Too many Chrome errors');

    // Number of users affected
    expect(wrapper.find('ItemValue').at(2).text()).toBe('20');

    // Number of events
    expect(wrapper.find('ItemValue').at(3).text()).toBe('100');
    expect(wrapper.find('ItemValue').at(4).text()).toBe('2 weeks');
  });

  it('renders open in discover button', async function () {
    const discoverOrg = {...organization, features: ['discover-basic', 'discover-query']};
    const wrapper = createWrapper(
      {},
      {...routerContext, context: {...routerContext.context, organization: discoverOrg}}
    );
    await tick();
    wrapper.update();

    const chartActions = wrapper.find('ChartActions');
    expect(chartActions.find('Button').text()).toBe('Open in Discover');
  });

  it('handles invalid incident', async function () {
    const wrapper = createWrapper({params: {orgId: 'org-slug', alertId: '456'}});
    await tick();
    wrapper.update();

    // Activity will also have a LoadingError
    expect(wrapper.find('LoadingError')).toHaveLength(2);
  });

  it('changes status to closed and fetches new activities', async function () {
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

    expect(wrapper.find('Status').at(0).text()).not.toBe('Resolved');
    wrapper.find('[data-test-id="status-dropdown"] DropdownButton').simulate('click');
    wrapper
      .find('[data-test-id="status-dropdown"] MenuItem span')
      .at(2)
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
    expect(wrapper.find('Status').at(0).text()).toBe('Resolved');
  });

  it('allows members to change issue status', async function () {
    const noAccessOrg = {...organization, access: ['project:read']};

    const wrapper = createWrapper(
      {},
      {...routerContext, context: {...routerContext.context, organization: noAccessOrg}}
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('Status').at(0).text()).not.toBe('Resolved');
    expect(wrapper.find('[data-test-id="status-dropdown"] DropdownButton').exists()).toBe(
      true
    );
  });

  it('toggles subscribe status with Subscribe button', async function () {
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
    expect(wrapper.find('SubscribeButton').text()).toBe('Unsubscribe');

    // Click to unsubscribe
    wrapper.find('SubscribeButton').simulate('click');
    expect(unsubscribe).toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(wrapper.find('SubscribeButton').text()).toBe('Subscribe');

    // Click again to re-subscribe
    wrapper.find('SubscribeButton').simulate('click');
    expect(subscribe).toHaveBeenCalled();
  });

  it('renders Errors as data source for Dataset.ERRORS', async function () {
    const wrapper = createWrapper();
    await tick();
    wrapper.update();

    const ruleDetails = wrapper.find('RuleDetails');
    expect(ruleDetails.find('span').at(1).text()).toBe('Errors');
  });
});

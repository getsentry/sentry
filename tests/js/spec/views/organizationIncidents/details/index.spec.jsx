import React from 'react';
import {mount} from 'enzyme';

import IncidentDetails from 'app/views/organizationIncidents/details';

describe('IncidentDetails', function() {
  const mockIncident = TestStubs.Incident();
  const routerContext = TestStubs.routerContext();

  beforeAll(function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/123/',
      body: mockIncident,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/456/',
      statusCode: 404,
    });
  });

  afterAll(function() {
    MockApiClient.clearMockResponses();
  });

  it('loads incident', async function() {
    const wrapper = mount(
      <IncidentDetails
        params={{orgId: 'org-slug', incidentId: mockIncident.identifier}}
      />,
      routerContext
    );

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
    const wrapper = mount(
      <IncidentDetails params={{orgId: 'org-slug', incidentId: '456'}} />,
      routerContext
    );
    await tick();
    wrapper.update();
    expect(wrapper.find('LoadingError')).toHaveLength(1);
  });
});

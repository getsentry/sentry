import React from 'react';
import {mount} from 'enzyme';

import IncidentDetails from 'app/views/organizationIncidents/detail';

describe('IncidentDetails', function() {
  const mockIncident = {
    id: '123',
    name: 'Too many Chrome errors',
    status: 'resolved',
    projects: [],
    suspects: [],
  };

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
      <IncidentDetails params={{orgId: 'org-slug', incidentId: mockIncident.id}} />
    );
    expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
    await tick();
    wrapper.update();
    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
  });

  it('handles invalid incident', async function() {
    const wrapper = mount(
      <IncidentDetails params={{orgId: 'org-slug', incidentId: '456'}} />
    );
    await tick();
    wrapper.update();
    expect(wrapper.find('LoadingError')).toHaveLength(1);
  });
});

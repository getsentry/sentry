import React from 'react';
import {mount} from 'enzyme';

import SavedQueryList from 'app/views/organizationDiscover/sidebar/savedQueryList';

describe('savedQueryList', function() {
  let organization, mockResponse;
  beforeEach(function() {
    organization = TestStubs.Organization();
    mockResponse = [];
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/discover/saved/`,
      method: 'GET',
      body: mockResponse,
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('renders empty state', async function() {
    const wrapper = mount(<SavedQueryList organization={organization} />);
    await tick();

    expect(wrapper.text()).toBe('No saved queries');
  });

  it('renders list', async function() {
    const savedQueries = [
      {
        id: '1',
        name: 'saved query #1',
        dateUpdated: '2018-09-24T00:00:00.000Z',
      },
      {
        id: '2',
        name: 'saved query #2',
        dateUpdated: '2018-09-24T00:00:00.000Z',
      },
    ];
    mockResponse.push(...savedQueries);
    const wrapper = mount(<SavedQueryList organization={organization} />);
    await tick();
    savedQueries.forEach(query => {
      expect(wrapper.text()).toContain(query.name);
      expect(wrapper.text()).toContain('Updated Sep 24 00:00:00 (UTC)');
    });
  });
});

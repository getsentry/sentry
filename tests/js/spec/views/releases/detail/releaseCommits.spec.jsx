import React from 'react';

import {mount} from 'sentry-test/enzyme';

import ReleaseCommits from 'app/views/releases/detail/releaseCommits';

describe('ReleaseCommits', function() {
  let wrapper, projectMockResponse, organizationMockResponse;

  beforeEach(function() {
    projectMockResponse = MockApiClient.addMockResponse({
      url: '/projects/123/456/releases/10.0/commits/',
      body: [TestStubs.Commit()],
    });

    organizationMockResponse = MockApiClient.addMockResponse({
      url: '/organizations/123/releases/10.0/commits/',
      body: [TestStubs.Commit()],
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('project release commits', function() {
    wrapper = mount(
      <ReleaseCommits
        params={{orgId: '123', projectId: '456', release: '10.0'}}
        location={{}}
      />
    );

    expect(wrapper).toSnapshot();
    expect(projectMockResponse).toHaveBeenCalled();
    expect(organizationMockResponse).not.toHaveBeenCalled();
  });

  it('organization release commits', function() {
    wrapper = mount(
      <ReleaseCommits params={{orgId: '123', release: '10.0'}} location={{}} />
    );

    expect(wrapper).toSnapshot();
    expect(projectMockResponse).not.toHaveBeenCalled();
    expect(organizationMockResponse).toHaveBeenCalled();
  });
});

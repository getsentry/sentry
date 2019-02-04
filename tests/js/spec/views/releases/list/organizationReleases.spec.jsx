import React from 'react';
import {mount} from 'enzyme';

import OrganizationReleases from 'app/views/releases/list/organizationReleases';

describe('OrganizationReleases', function() {
  let organization;
  let props;
  let wrapper;

  beforeEach(function() {
    organization = TestStubs.Organization({
      projects: [TestStubs.Project()],
      features: ['sentry10', 'global-views'],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [TestStubs.Release({version: 'abc'}), TestStubs.Release({version: 'def'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/environments/',
      body: TestStubs.Environments(),
    });

    MockApiClient.addMockResponse({
      url: '/promptsactivity/',
    });

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/completion/',
    });

    props = {
      organization,
      selection: {projects: [2]},
      params: {orgId: organization.slug},
      location: {query: {per_page: 0, query: 'derp'}},
    };

    wrapper = mount(
      <OrganizationReleases {...props} />,
      TestStubs.routerContext([{organization}])
    );
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('renders list', function() {
    const content = wrapper.find('PageContent');
    const releases = content.find('Version');
    expect(releases).toHaveLength(2);
    expect(releases.map(item => item.text())).toEqual(['abc', 'def']);
  });

  it('renders no query state if project has a release', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });
    organization.projects = [TestStubs.Project({latestRelease: 'abcdef'})];
    wrapper = mount(
      <OrganizationReleases {...props} />,
      TestStubs.routerContext([{organization}])
    );
    const content = wrapper.find('PageContent');
    expect(content.text()).toContain('Sorry, no releases match your filters');
  });

  it('renders landing state if project does not have a release', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });
    wrapper = mount(
      <OrganizationReleases {...props} />,
      TestStubs.routerContext([{organization}])
    );
    const landing = wrapper.find('ReleaseLanding');
    expect(landing).toHaveLength(1);
  });
});

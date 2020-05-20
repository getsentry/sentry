import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectsStore from 'app/stores/projectsStore';
import ReleaseList from 'app/views/releases/list/';

describe('ReleaseList', function() {
  let organization;
  let props;
  let wrapper;

  beforeEach(async function() {
    organization = TestStubs.Organization({
      projects: [TestStubs.Project()],
      features: ['global-views'],
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
      url: '/organizations/org-slug/projects/',
      body: [],
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

    ProjectsStore.loadInitialData(organization.projects);
    wrapper = mountWithTheme(
      <ReleaseList {...props} />,
      TestStubs.routerContext([{organization}])
    );
    await tick();
    wrapper.update();
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

  it('renders no query state if selected project has a release', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });
    organization.projects = [TestStubs.Project({latestRelease: 'abcdef'})];
    wrapper = mountWithTheme(
      <ReleaseList {...props} />,
      TestStubs.routerContext([{organization}])
    );
    const content = wrapper.find('PageContent');
    expect(content.text()).toContain('Sorry, no releases match your filters');
  });

  it('renders no query state if any member project has a release and "All projects" is selected', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });
    organization.projects = [TestStubs.Project({latestRelease: 'abcdef'})];
    props.selection = {projects: []};
    wrapper = mountWithTheme(
      <ReleaseList {...props} />,
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
    wrapper = mountWithTheme(
      <ReleaseList {...props} />,
      TestStubs.routerContext([{organization}])
    );
    const landing = wrapper.find('ReleaseLanding');
    expect(landing).toHaveLength(1);
  });
});

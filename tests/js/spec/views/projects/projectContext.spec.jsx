import React from 'react';
import {mount} from 'enzyme';

import {ProjectContext} from 'app/views/projects/projectContext';
import SentryTypes from 'app/sentryTypes';

jest.unmock('app/utils/recreateRoute');
jest.mock('app/actionCreators/modal', () => ({
  redirectToProject: jest.fn(),
}));

describe('projectContext component', function() {
  const routes = [
    {path: '/', childRoutes: []},
    {name: 'Organizations', path: ':orgId/', childRoutes: []},
    {name: 'Projects', path: ':projectId/', childRoutes: []},
  ];

  const location = {};

  const project = TestStubs.Project();
  const org = TestStubs.Organization();

  it('displays error on 404s', function() {
    const router = TestStubs.router();

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 404,
    });

    const projectContext = (
      <ProjectContext
        params={{orgId: org.slug, projectId: project.slug}}
        projects={[]}
        routes={routes}
        router={router}
        location={location}
        orgId={org.slug}
        projectId={project.slug}
      />
    );

    const wrapper = mount(projectContext, {
      context: {organization: org},
      childContextTypes: {organization: SentryTypes.Organization},
    });

    expect(wrapper.state('error')).toBe(true);
    expect(wrapper.state('loading')).toBe(false);
    expect(wrapper.state('errorType')).toBe('PROJECT_NOT_FOUND');
  });

  it('fetches data again if projectId changes', function() {
    const router = TestStubs.router();
    let fetchMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: project,
    });

    const projectContext = (
      <ProjectContext
        params={{orgId: org.slug, projectId: project.slug}}
        projects={[]}
        routes={routes}
        router={router}
        location={location}
        orgId={org.slug}
        projectId={project.slug}
      />
    );

    const wrapper = mount(projectContext, {
      context: {organization: org},
      childContextTypes: {organization: SentryTypes.Organization},
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Nothing should happen if we update and projectId is the same
    wrapper.update();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/new-slug/`,
      method: 'GET',
      statusCode: 200,
      body: TestStubs.Project({slug: 'new-slug'}),
    });

    wrapper.setProps({
      projectId: 'new-slug',
    });
    wrapper.update();

    expect(fetchMock).toHaveBeenCalled();
  });
});

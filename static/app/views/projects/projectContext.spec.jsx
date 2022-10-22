import {Organization} from 'fixtures/js-stubs/organization';
import {Project} from 'fixtures/js-stubs/project';
import {router} from 'fixtures/js-stubs/router';

import {mountWithTheme} from 'sentry-test/enzyme';

import {ProjectContext} from 'sentry/views/projects/projectContext';

jest.unmock('sentry/utils/recreateRoute');
jest.mock('sentry/actionCreators/modal', () => ({
  redirectToProject: jest.fn(),
}));

describe('projectContext component', function () {
  const routes = [
    {path: '/', childRoutes: []},
    {name: 'Organizations', path: ':orgId/', childRoutes: []},
    {name: 'Projects', path: ':projectId/', childRoutes: []},
  ];

  const location = {query: {}};

  const project = Project();
  const org = Organization();
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    [project.slug, 'new-slug'].forEach(slug => {
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${slug}/members/`,
        method: 'GET',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${slug}/environments/`,
        method: 'GET',
        body: [],
      });
    });
  });

  it('displays error on 404s', async function () {
    const router = router();

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 404,
    });

    const projectContext = (
      <ProjectContext
        api={new MockApiClient()}
        params={{orgId: org.slug, projectId: project.slug}}
        projects={[]}
        routes={routes}
        router={router}
        location={location}
        orgId={org.slug}
        projectId={project.slug}
      />
    );

    const wrapper = mountWithTheme(projectContext);

    await tick();
    wrapper.update();

    expect(wrapper.state('error')).toBe(true);
    expect(wrapper.state('loading')).toBe(false);
    expect(wrapper.state('errorType')).toBe('PROJECT_NOT_FOUND');
  });

  it('fetches data again if projectId changes', function () {
    const router = router();
    let fetchMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: project,
    });

    const projectContext = (
      <ProjectContext
        api={new MockApiClient()}
        params={{orgId: org.slug, projectId: project.slug}}
        projects={[]}
        routes={routes}
        router={router}
        location={location}
        orgId={org.slug}
        projectId={project.slug}
      />
    );

    const wrapper = mountWithTheme(projectContext);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Nothing should happen if we update and projectId is the same
    wrapper.update();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/new-slug/`,
      method: 'GET',
      statusCode: 200,
      body: Project({slug: 'new-slug'}),
    });

    wrapper.setProps({
      projectId: 'new-slug',
    });
    wrapper.update();

    expect(fetchMock).toHaveBeenCalled();
  });

  it('fetches data again if projects list changes', function () {
    const router = router();
    const fetchMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: project,
    });

    const projectContext = (
      <ProjectContext
        api={new MockApiClient()}
        params={{orgId: org.slug, projectId: project.slug}}
        projects={[]}
        routes={routes}
        router={router}
        location={location}
        orgId={org.slug}
        projectId={project.slug}
      />
    );

    const wrapper = mountWithTheme(projectContext);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The project will become active, thus requesting org members
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/users/`,
      method: 'GET',
      statusCode: 200,
      body: [],
    });

    wrapper.setProps({projects: [project]});
    wrapper.update();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectCspReports from 'app/views/settings/projectSecurityHeaders/csp';

describe('ProjectCspReports', function () {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const projectUrl = `/projects/${org.slug}/${project.slug}/`;
  const routeUrl = `/projects/${org.slug}/${project.slug}/csp/`;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: projectUrl,
      method: 'GET',
      body: {
        options: {},
      },
    });
  });

  it('renders', function () {
    const wrapper = mountWithTheme(
      <ProjectCspReports
        organization={org}
        project={project}
        {...TestStubs.routerProps({
          params: {orgId: org.slug, projectId: project.slug},
          location: TestStubs.location({pathname: routeUrl}),
        })}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper).toSnapshot();
  });

  it('can enable default ignored sources', function () {
    const wrapper = mountWithTheme(
      <ProjectCspReports
        organization={org}
        project={project}
        {...TestStubs.routerProps({
          params: {orgId: org.slug, projectId: project.slug},
          location: TestStubs.location({pathname: routeUrl}),
        })}
      />,
      TestStubs.routerContext()
    );

    const mock = MockApiClient.addMockResponse({
      url: projectUrl,
      method: 'PUT',
    });

    expect(mock).not.toHaveBeenCalled();

    // Click Regenerate Token
    wrapper.find('Switch').simulate('click');

    expect(mock).toHaveBeenCalledWith(
      projectUrl,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {
            'sentry:csp_ignored_sources_defaults': true,
          },
        },
      })
    );
  });

  it('can set additional ignored sources', function () {
    const wrapper = mountWithTheme(
      <ProjectCspReports
        organization={org}
        project={project}
        {...TestStubs.routerProps({
          params: {orgId: org.slug, projectId: project.slug},
          location: TestStubs.location({pathname: routeUrl}),
        })}
      />,
      TestStubs.routerContext()
    );

    const mock = MockApiClient.addMockResponse({
      url: projectUrl,
      method: 'PUT',
    });

    expect(mock).not.toHaveBeenCalled();

    // Click Regenerate Token
    wrapper
      .find('textarea')
      .simulate('change', {
        target: {
          value: `test
test2`,
        },
      })
      .simulate('blur');

    expect(mock).toHaveBeenCalledWith(
      projectUrl,
      expect.objectContaining({
        method: 'PUT',
        data: {
          // XXX: Org details endpoints accept these multiline inputs as a list, where as it looks like project details accepts it as a string with newlines
          options: {
            'sentry:csp_ignored_sources': `test
test2`,
          },
        },
      })
    );
  });
});

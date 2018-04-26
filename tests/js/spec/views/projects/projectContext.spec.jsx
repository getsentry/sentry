import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import {ProjectContext} from 'app/views/projects/projectContext';
import SentryTypes from 'app/proptypes';

jest.unmock('app/utils/recreateRoute');

describe('projectContext component', function() {
  const routes = [
    {path: '/', childRoutes: []},
    {name: 'Organizations', path: ':orgId/', childRoutes: []},
    {name: 'Projects', path: ':projectId/', childRoutes: []},
  ];

  const location = {};

  const project = TestStubs.Project();
  const org = TestStubs.Organization();

  it('redirects for renamed projects', function() {
    const router = TestStubs.router();

    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 302,
      body: {
        detail: {slug: 'renamed-slug'},
      },
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

    mount(projectContext, {
      context: {organization: org},
      childContextTypes: {organization: SentryTypes.Organization},
    });

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(`/${org.slug}/renamed-slug/`);
  });
});

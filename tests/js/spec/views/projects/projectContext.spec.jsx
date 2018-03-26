import React from 'react';
import {mount} from 'enzyme';
import {browserHistory} from 'react-router';

import {Client} from 'app/api';
import ProjectContext from 'app/views/projects/projectContext';
import SentryTypes from 'app/proptypes';

describe('projectContext component', function() {
  const sandbox = sinon.sandbox.create();

  const routes = [
    {path: '/', childRoutes: []},
    {name: 'Organizations', path: ':orgId/', childRoutes: []},
    {name: 'Projects', path: ':projectId/', childRoutes: []},
  ];

  const location = {};

  const project = TestStubs.Project();
  const org = TestStubs.Organization();

  it('redirects for renamed projects', function() {
    sandbox.stub(browserHistory, 'replace').returns(jest.fn());

    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 301,
      body: {
        detail: {slug: 'renamed-slug'},
      },
    });

    const projectContext = (
      <ProjectContext
        params={{orgId: org.slug, projectId: project.slug}}
        routes={routes}
        location={location}
        orgId={org.slug}
        projectId={project.slug}
      />
    );

    mount(projectContext, {
      context: {organization: org},
      childContextTypes: {organization: SentryTypes.Organization},
    });

    expect(browserHistory.replace.calledOnce).toBeTruthy();
    expect(browserHistory.replace.args[0]).toEqual([`/${org.slug}/renamed-slug/`]);
  });
});

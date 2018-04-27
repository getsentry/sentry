import React from 'react';

import {mount, shallow} from 'enzyme';
import ProjectCspReports from 'app/views/settings/projectSecurityHeaders/csp';

describe('ProjectCspReports', function() {
  let org = TestStubs.Organization();
  let project = TestStubs.Project();
  let projectUrl = `/projects/${org.slug}/${project.slug}/`;
  let routeUrl = `/projects/${org.slug}/${project.slug}/csp/`;

  beforeEach(function() {
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

  it('renders', function() {
    let wrapper = shallow(
      <ProjectCspReports
        organization={org}
        project={project}
        setProjectNavSection={() => {}}
        {...TestStubs.routerProps({
          params: {orgId: org.slug, projectId: project.slug},
          location: TestStubs.location({pathname: routeUrl}),
        })}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('can enable default ignored sources', function() {
    let wrapper = mount(
      <ProjectCspReports
        organization={org}
        project={project}
        setProjectNavSection={() => {}}
        {...TestStubs.routerProps({
          params: {orgId: org.slug, projectId: project.slug},
          location: TestStubs.location({pathname: routeUrl}),
        })}
      />,
      TestStubs.routerContext()
    );

    let mock = MockApiClient.addMockResponse({
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

  it('can set additional ignored sources', function() {
    let wrapper = mount(
      <ProjectCspReports
        organization={org}
        project={project}
        setProjectNavSection={() => {}}
        {...TestStubs.routerProps({
          params: {orgId: org.slug, projectId: project.slug},
          location: TestStubs.location({pathname: routeUrl}),
        })}
      />,
      TestStubs.routerContext()
    );

    let mock = MockApiClient.addMockResponse({
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

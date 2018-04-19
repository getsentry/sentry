import React from 'react';

import {mount} from 'enzyme';
import ProjectCspReports from 'app/views/settings/project/projectCspReports';

describe('ProjectCspReports', function() {
  let org = TestStubs.Organization();
  let project = TestStubs.Project();
  let url = `/projects/${org.slug}/${project.slug}/`;

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url,
      method: 'GET',
      body: {
        options: {},
      },
    });
  });

  it('can enable default ignored sources', function() {
    let wrapper = mount(
      <ProjectCspReports
        organization={org}
        project={project}
        setProjectNavSection={() => {}}
        params={{orgId: org.slug, projectId: project.slug}}
      />,
      TestStubs.routerContext()
    );

    let mock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
    });

    expect(mock).not.toHaveBeenCalled();

    // Click Regenerate Token
    wrapper.find('Switch').simulate('click');

    expect(mock).toHaveBeenCalledWith(
      url,
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
        params={{orgId: org.slug, projectId: project.slug}}
      />,
      TestStubs.routerContext()
    );

    let mock = MockApiClient.addMockResponse({
      url,
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
      url,
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

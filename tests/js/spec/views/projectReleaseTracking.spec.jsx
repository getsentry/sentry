import React from 'react';

import {mount} from 'enzyme';
import {ProjectReleaseTracking} from 'app/views/settings/project/projectReleaseTracking';

describe('ProjectReleaseTracking', function() {
  let org = TestStubs.Organization();
  let project = TestStubs.Project();
  let url = `/projects/${org.slug}/${project.slug}/releases/token/`;

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: TestStubs.Plugins(),
    });
    MockApiClient.addMockResponse({
      url,
      method: 'GET',
      body: {
        webhookUrl: 'webhook-url',
        token: 'token token token',
      },
    });
  });

  it('renders with token', function() {
    let wrapper = mount(
      <ProjectReleaseTracking
        organization={org}
        project={project}
        plugins={{loading: false, plugins: TestStubs.Plugins()}}
        params={{orgId: org.slug, projectId: project.slug}}
      />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('TextCopyInput').prop('children')).toBe('token token token');
  });

  it('can regenerate token', function(done) {
    let wrapper = mount(
      <ProjectReleaseTracking
        organization={org}
        project={project}
        plugins={{loading: false, plugins: TestStubs.Plugins()}}
        params={{orgId: org.slug, projectId: project.slug}}
      />,
      TestStubs.routerContext()
    );

    let mock = MockApiClient.addMockResponse({
      url,
      method: 'POST',
    });

    // Click Regenerate Token
    wrapper.find('Field[label="Regenerate Token"] Button').simulate('click');
    expect(wrapper.find('ModalDialog')).toHaveLength(1);

    expect(mock).not.toHaveBeenCalled();

    wrapper.find('ModalDialog Button[priority="danger"]').simulate('click');

    setTimeout(() => {
      expect(mock).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          method: 'POST',
          data: {
            project: project.slug,
          },
        })
      );
      done();
    }, 1);
  });
});

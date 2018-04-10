import {browserHistory} from 'react-router';
import React from 'react';

import ProjectGeneralSettings from 'app/views/projectGeneralSettings';
import ProjectContext from 'app/views/projects/projectContext';
import ProjectsStore from 'app/stores/projectsStore';
import {mountWithTheme} from '../../../helpers';

jest.mock('app/utils/recreateRoute');
jest.mock('jquery');

describe('projectGeneralSettings', function() {
  let org = TestStubs.Organization();
  let project = TestStubs.ProjectDetails();
  let routerContext;
  let putMock;

  beforeEach(function() {
    sinon.stub(window.location, 'assign');
    routerContext = TestStubs.routerContext([
      {
        router: TestStubs.router({
          params: {
            projectId: project.slug,
            orgId: org.slug,
          },
        }),
      },
    ]);

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/environments/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/members/`,
      method: 'GET',
      body: [],
    });
  });

  afterEach(function() {
    window.location.assign.restore();
  });

  it('renders form fields', function() {
    let wrapper = mountWithTheme(
      <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('Input[name="name"]').prop('value')).toBe('Project Name');
    expect(wrapper.find('Input[name="slug"]').prop('value')).toBe('project-slug');
    expect(wrapper.find('Input[name="subjectTemplate"]').prop('value')).toBe(
      '[$project] ${tag:level}: $title'
    );
    expect(wrapper.find('RangeSlider[name="resolveAge"]').prop('value')).toBe(48);
    expect(wrapper.find('Switch[name="dataScrubber"]').prop('isActive')).toBeFalsy();
    expect(
      wrapper.find('Switch[name="dataScrubberDefaults"]').prop('isActive')
    ).toBeFalsy();
    expect(wrapper.find('Switch[name="scrubIPAddresses"]').prop('isActive')).toBeFalsy();
    expect(wrapper.find('TextArea[name="sensitiveFields"]').prop('value')).toBe(
      'creditcard\nssn'
    );
    expect(wrapper.find('TextArea[name="safeFields"]').prop('value')).toBe(
      'business-email\ncompany'
    );
    expect(wrapper.find('TextArea[name="allowedDomains"]').prop('value')).toBe(
      'example.com\nhttps://example.com'
    );
    expect(wrapper.find('Switch[name="scrapeJavaScript"]').prop('isActive')).toBeTruthy();
    expect(wrapper.find('Input[name="securityToken"]').prop('value')).toBe(
      'security-token'
    );
    expect(wrapper.find('Input[name="securityTokenHeader"]').prop('value')).toBe(
      'x-security-header'
    );
    expect(wrapper.find('Switch[name="verifySSL"]').prop('isActive')).toBeTruthy();
  });

  it('disables field when equivalent org setting is true', function() {
    routerContext.context.organization.dataScrubber = true;
    routerContext.context.organization.scrubIPAddresses = false;
    let wrapper = mountWithTheme(
      <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />,
      routerContext
    );
    expect(wrapper.find('Switch[name="scrubIPAddresses"]').prop('isDisabled')).toBe(
      false
    );
    expect(wrapper.find('Switch[name="scrubIPAddresses"]').prop('isActive')).toBeFalsy();
    expect(wrapper.find('Switch[name="dataScrubber"]').prop('isDisabled')).toBe(true);
    expect(wrapper.find('Switch[name="dataScrubber"]').prop('isActive')).toBe(true);
  });

  it('project admins can remove project', function() {
    let deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'DELETE',
    });

    let wrapper = mountWithTheme(
      <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />,
      TestStubs.routerContext()
    );

    let removeBtn = wrapper.find('.ref-remove-project').first();

    expect(removeBtn.prop('children')).toBe('Remove Project');

    // Click button
    removeBtn.simulate('click');

    // Confirm Modal
    wrapper.find('Modal Button[priority="danger"]').simulate('click');

    expect(deleteMock).toHaveBeenCalled();
  });

  it('project admins can transfer project', function() {
    let deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/transfer/`,
      method: 'POST',
    });

    let wrapper = mountWithTheme(
      <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />,
      TestStubs.routerContext()
    );

    let removeBtn = wrapper.find('.ref-transfer-project').first();

    expect(removeBtn.prop('children')).toBe('Transfer Project');

    // Click button
    removeBtn.simulate('click');

    // Confirm Modal
    wrapper
      .find('input[name="email"]')
      .simulate('change', {target: {value: 'billy@sentry.io'}});
    wrapper.find('Modal Button[priority="danger"]').simulate('click');

    expect(deleteMock).toHaveBeenCalledWith(
      `/projects/${org.slug}/${project.slug}/transfer/`,
      expect.objectContaining({
        method: 'POST',
        data: {
          email: 'billy@sentry.io',
        },
      })
    );
  });

  it('displays transfer/remove message for non-admins', function() {
    routerContext.context.organization.access = ['org:read'];
    let wrapper = mountWithTheme(
      <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />,
      routerContext
    );

    expect(wrapper.html()).toContain(
      'You do not have the required permission to remove this project.'
    );
    expect(wrapper.html()).toContain(
      'You do not have the required permission to transfer this project.'
    );
  });

  it('changing slug updates ProjectsStore', async function() {
    let params = {orgId: org.slug, projectId: project.slug};
    ProjectsStore.loadInitialData([project]);
    putMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'PUT',
      body: {
        ...project,
        slug: 'new-project',
      },
    });
    let wrapper = mountWithTheme(
      <ProjectContext orgId={org.slug} projectId={project.slug}>
        <ProjectGeneralSettings
          routes={[]}
          location={routerContext.context.location}
          params={params}
        />
      </ProjectContext>,
      routerContext
    );
    await tick();
    wrapper.update();

    // Change slug to new-slug
    wrapper
      .find('input[name="slug"]')
      .simulate('change', {target: {value: 'new-project'}})
      .simulate('blur');

    expect(putMock).toHaveBeenCalled();

    await tick();
    // :(
    await tick();
    wrapper.update();
    // updates ProjectsStore
    expect(ProjectsStore.itemsById['2'].slug).toBe('new-project');
    expect(browserHistory.replace).toHaveBeenCalled();
    // We can't do this because of ThemeProvider (ProjectContext needs to be root in order to `setProps`)
    // wrapper.find('ProjectContext').setProps({
    // projectId: 'new-project',
    // });
    wrapper.update();
    expect(wrapper.find('Input[name="slug"]').prop('value')).toBe('new-project');
  });
});

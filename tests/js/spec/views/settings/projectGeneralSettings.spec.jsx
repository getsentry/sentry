import {browserHistory} from 'react-router';
import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select';

import ProjectContext from 'app/views/projects/projectContext';
import ProjectGeneralSettings from 'app/views/settings/projectGeneralSettings';
import ProjectsStore from 'app/stores/projectsStore';

jest.mock('jquery');

describe('projectGeneralSettings', function () {
  const org = TestStubs.Organization();
  const project = TestStubs.ProjectDetails();
  const groupingConfigs = TestStubs.GroupingConfigs();
  const groupingEnhancements = TestStubs.GroupingEnhancements();
  let routerContext;
  let putMock;

  beforeEach(function () {
    jest.spyOn(window.location, 'assign');
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
      url: '/grouping-configs/',
      method: 'GET',
      body: groupingConfigs,
    });
    MockApiClient.addMockResponse({
      url: '/grouping-enhancements/',
      method: 'GET',
      body: groupingEnhancements,
    });
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
      url: `/organizations/${org.slug}/users/`,
      method: 'GET',
      body: [],
    });
  });

  afterEach(function () {
    window.location.assign.mockRestore();
  });

  it('renders form fields', function () {
    const wrapper = mountWithTheme(
      <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('Input[name="slug"]').prop('value')).toBe('project-slug');
    expect(wrapper.find('Input[name="subjectPrefix"]').prop('value')).toBe('[my-org]');
    expect(wrapper.find('RangeSlider[name="resolveAge"]').prop('value')).toBe(48);
    expect(wrapper.find('TextArea[name="allowedDomains"]').prop('value')).toBe(
      'example.com\nhttps://example.com'
    );
    expect(wrapper.find('Switch[name="scrapeJavaScript"]').prop('isDisabled')).toBe(
      false
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

  it('disables scrapeJavaScript when equivalent org setting is false', function () {
    routerContext.context.organization.scrapeJavaScript = false;
    const wrapper = mountWithTheme(
      <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />,
      routerContext
    );
    expect(wrapper.find('Switch[name="scrapeJavaScript"]').prop('isDisabled')).toBe(true);
    expect(wrapper.find('Switch[name="scrapeJavaScript"]').prop('isActive')).toBeFalsy();
  });

  it('project admins can remove project', function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'DELETE',
    });

    const wrapper = mountWithTheme(
      <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />,
      TestStubs.routerContext()
    );

    const removeBtn = wrapper.find('.ref-remove-project').first();

    expect(removeBtn.prop('children')).toBe('Remove Project');

    // Click button
    removeBtn.simulate('click');

    // Confirm Modal
    wrapper.find('Modal Button[priority="danger"]').simulate('click');

    expect(deleteMock).toHaveBeenCalled();
  });

  it('project admins can transfer project', function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/transfer/`,
      method: 'POST',
    });

    const wrapper = mountWithTheme(
      <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />,
      TestStubs.routerContext()
    );

    const removeBtn = wrapper.find('.ref-transfer-project').first();

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

  it('displays transfer/remove message for non-admins', function () {
    routerContext.context.organization.access = ['org:read'];
    const wrapper = mountWithTheme(
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

  it('disables the form for users without write permissions', function () {
    routerContext.context.organization.access = ['org:read'];
    const wrapper = mountWithTheme(
      <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />,
      routerContext
    );

    expect(wrapper.find('FormField[disabled=false]')).toHaveLength(0);
    expect(wrapper.find('Alert').first().text()).toBe(
      'These settings can only be edited by users with the organization owner, manager, or admin role.'
    );
  });

  it('changing project platform updates ProjectsStore', async function () {
    const params = {orgId: org.slug, projectId: project.slug};
    ProjectsStore.loadInitialData([project]);
    putMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'PUT',
      body: {
        ...project,
        platform: 'javascript',
      },
    });
    const wrapper = mountWithTheme(
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
    selectByValue(wrapper, 'javascript');

    // Slug does not save on blur
    expect(putMock).toHaveBeenCalled();

    await tick();
    await tick();
    wrapper.update();

    // updates ProjectsStore
    expect(ProjectsStore.itemsById['2'].platform).toBe('javascript');
  });

  it('changing slug updates ProjectsStore', async function () {
    const params = {orgId: org.slug, projectId: project.slug};
    ProjectsStore.loadInitialData([project]);
    putMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'PUT',
      body: {
        ...project,
        slug: 'new-project',
      },
    });
    const wrapper = mountWithTheme(
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
      .simulate('change', {target: {value: 'NEW PROJECT'}})
      .simulate('blur');

    // Slug does not save on blur
    expect(putMock).not.toHaveBeenCalled();
    wrapper.find('SaveButton').simulate('click');

    // fetches new slug
    const newProjectGet = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/new-project/`,
      method: 'GET',
      body: {...project, slug: 'new-project'},
    });
    const newProjectMembers = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/users/`,
      method: 'GET',
      body: [],
    });

    await tick();
    // :(
    await tick();
    wrapper.update();
    // updates ProjectsStore
    expect(ProjectsStore.itemsById['2'].slug).toBe('new-project');
    expect(browserHistory.replace).toHaveBeenCalled();
    expect(wrapper.find('Input[name="slug"]').prop('value')).toBe('new-project');

    wrapper.setProps({
      projectId: 'new-project',
    });
    await tick();
    wrapper.update();
    expect(newProjectGet).toHaveBeenCalled();
    expect(newProjectMembers).toHaveBeenCalled();
  });

  describe('Non-"save on blur" Field', function () {
    let wrapper;

    beforeEach(function () {
      const params = {orgId: org.slug, projectId: project.slug};
      ProjectsStore.loadInitialData([project]);
      putMock = MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/`,
        method: 'PUT',
        body: {
          ...project,
          slug: 'new-project',
        },
      });
      wrapper = mountWithTheme(
        <ProjectContext orgId={org.slug} projectId={project.slug}>
          <ProjectGeneralSettings
            routes={[]}
            location={routerContext.context.location}
            params={params}
          />
        </ProjectContext>,
        routerContext
      );
    });

    it('can cancel unsaved changes for a field', async function () {
      await tick();
      wrapper.update();
      // Initially does not have "Cancel" button
      expect(wrapper.find('MessageAndActions CancelButton')).toHaveLength(0);
      // Has initial value
      expect(wrapper.find('input[name="resolveAge"]').prop('value')).toBe(19);

      // Change value
      wrapper
        .find('input[name="resolveAge"]')
        .simulate('input', {target: {value: 12}})
        .simulate('mouseUp');

      // Has updated value
      expect(wrapper.find('input[name="resolveAge"]').prop('value')).toBe(12);
      // Has "Cancel" button visible
      expect(wrapper.find('MessageAndActions CancelButton')).toHaveLength(1);

      // Click cancel
      wrapper.find('MessageAndActions CancelButton').simulate('click');
      // Cancel row should disappear
      expect(wrapper.find('MessageAndActions CancelButton')).toHaveLength(0);
      // Value should be reverted
      expect(wrapper.find('input[name="resolveAge"]').prop('value')).toBe(19);
      // PUT should not be called
      expect(putMock).not.toHaveBeenCalled();
    });

    it('saves when value is changed and "Save" clicked', async function () {
      await tick();
      wrapper.update();
      // Initially does not have "Save" button
      expect(wrapper.find('MessageAndActions SaveButton')).toHaveLength(0);

      // Change value
      wrapper
        .find('input[name="resolveAge"]')
        .simulate('input', {target: {value: 12}})
        .simulate('mouseUp');

      // Has "Save" button visible
      expect(wrapper.find('MessageAndActions SaveButton')).toHaveLength(1);

      // Should not have put mock called yet
      expect(putMock).not.toHaveBeenCalled();

      // Click "Save"
      wrapper.find('MessageAndActions SaveButton').simulate('click');
      // API endpoint should have been called
      expect(putMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            resolveAge: 12,
          },
        })
      );

      // Should hide "Save" button after saving
      await tick();
      wrapper.update();
      expect(wrapper.find('MessageAndActions SaveButton')).toHaveLength(0);
    });
  });
});

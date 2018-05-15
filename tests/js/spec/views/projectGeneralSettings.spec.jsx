import {browserHistory} from 'react-router';
import {mount} from 'enzyme';
import React from 'react';

import ProjectGeneralSettings from 'app/views/settings/projectGeneralSettings';
import ProjectContext from 'app/views/projects/projectContext';
import ProjectsStore from 'app/stores/projectsStore';

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
    let wrapper = mount(
      <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('Input[name="name"]').prop('value')).toBe('Project Name');
    expect(wrapper.find('Input[name="slug"]').prop('value')).toBe('project-slug');
    expect(wrapper.find('Input[name="subjectPrefix"]').prop('value')).toBe('[my-org]');
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
    let wrapper = mount(
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

    let wrapper = mount(
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

    let wrapper = mount(
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
    let wrapper = mount(
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
    let wrapper = mount(
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

    // Slug does not save on blur
    expect(putMock).not.toHaveBeenCalled();
    wrapper.find('SaveButton').simulate('click');

    await tick();
    // :(
    await tick();
    wrapper.update();
    // updates ProjectsStore
    expect(ProjectsStore.itemsById['2'].slug).toBe('new-project');
    expect(browserHistory.replace).toHaveBeenCalled();
    expect(wrapper.find('Input[name="slug"]').prop('value')).toBe('new-project');

    // fetches new slug
    let newProjectGet = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/new-project/`,
      method: 'GET',
      body: {...project, slug: 'new-project'},
    });
    let newProjectEnv = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/new-project/environments/`,
      method: 'GET',
      body: [],
    });
    let newProjectMembers = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/new-project/members/`,
      method: 'GET',
      body: [],
    });

    wrapper.setProps({
      projectId: 'new-project',
    });
    expect(newProjectGet).toHaveBeenCalled();
    expect(newProjectEnv).toHaveBeenCalled();
    expect(newProjectMembers).toHaveBeenCalled();
  });

  describe('Non-"save on blur" Field', function() {
    let wrapper;

    beforeEach(function() {
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
      wrapper = mount(
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

    it('can cancel unsaved changes for a field', async function() {
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

    it('saves when value is changed and "Save" clicked', async function() {
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

import React from 'react';
import {ThemeProvider} from 'emotion-theming';
import {mount} from 'enzyme';

import {Client} from 'app/api';

import ProjectGeneralSettings from 'app/views/projectGeneralSettings';
import theme from 'app/utils/theme';

jest.mock('jquery');

describe('projectGeneralSettings', function() {
  let org = TestStubs.Organization();
  let project = TestStubs.Project();

  beforeEach(function() {
    sinon.stub(window.location, 'assign');
    Client.clearMockResponses();
    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
  });

  afterEach(function() {
    window.location.assign.restore();
  });

  it('renders form fields', function() {
    let wrapper = mount(
      <ThemeProvider theme={theme}>
        <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />
      </ThemeProvider>,
      TestStubs.routerContext()
    );

    expect(wrapper.find('Input[name="name"]').prop('value')).toBe('Project Name');
    expect(wrapper.find('Input[name="slug"]').prop('value')).toBe('project-slug');
    expect(wrapper.find('Input[name="subjectTemplate"]').prop('value')).toBe(
      '[$project] ${tag:level}: $title'
    );
    expect(wrapper.find('Input[name="defaultEnvironment"]').prop('value')).toBe('');
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
    let routerContext = TestStubs.routerContext();
    routerContext.context.organization.dataScrubber = true;
    routerContext.context.organization.scrubIPAddresses = false;
    let wrapper = mount(
      <ThemeProvider theme={theme}>
        <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />
      </ThemeProvider>,
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
    let deleteMock = Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'DELETE',
    });

    let wrapper = mount(
      <ThemeProvider theme={theme}>
        <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />
      </ThemeProvider>,
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
    let deleteMock = Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/transfer/`,
      method: 'POST',
    });

    let wrapper = mount(
      <ThemeProvider theme={theme}>
        <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />
      </ThemeProvider>,
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
    let routerContext = TestStubs.routerContext();
    routerContext.context.organization.access = ['org:read'];
    let wrapper = mount(
      <ThemeProvider theme={theme}>
        <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />
      </ThemeProvider>,
      routerContext
    );

    expect(wrapper.html()).toContain(
      'You do not have the required permission to remove this project.'
    );
    expect(wrapper.html()).toContain(
      'You do not have the required permission to transfer this project.'
    );
  });
});

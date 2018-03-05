import React from 'react';
import {ThemeProvider} from 'emotion-theming';
import {mount} from 'enzyme';

import {Client} from 'app/api';

import ProjectGeneralSettings from 'app/views/projectGeneralSettings';
import theme from 'app/utils/theme';

describe('projectGeneralSettings', function() {
  let org = TestStubs.Organization();
  let project = TestStubs.Project();

  beforeEach(function() {
    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
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

  it('project admins can transfer or remove project', function() {
    let wrapper = mount(
      <ThemeProvider theme={theme}>
        <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />
      </ThemeProvider>,
      TestStubs.routerContext()
    );

    let removeBtn = wrapper.find('a.btn.btn-danger').first();
    let transferBtn = wrapper.find('a.btn.btn-danger').at(1);

    expect(removeBtn.text()).toBe('Remove Project');
    expect(transferBtn.text()).toBe('Transfer Project');
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

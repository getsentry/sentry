import React from 'react';
import {ThemeProvider} from 'emotion-theming';
import {mount, shallow} from 'enzyme';

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

  it('renders', function() {
    let component = shallow(
      <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />,
      {
        context: {
          organization: org,
        },
      }
    );
    expect(component).toMatchSnapshot();
  });

  it('disables field with an org override', function() {
    let routerContext = TestStubs.routerContext();
    routerContext.context.organization.dataScrubber = true;
    let component = mount(
      <ThemeProvider theme={theme}>
        <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />
      </ThemeProvider>,
      routerContext
    );
    expect(component.find('Switch[name="dataScrubber"]').prop('isDisabled')).toBe(true);
  });

  it('project admins can transfer or remove project', function() {
    let component = mount(
      <ThemeProvider theme={theme}>
        <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />
      </ThemeProvider>,
      TestStubs.routerContext()
    );

    let removeBtn = component.find('a.btn.btn-danger').first();
    let transferBtn = component.find('a.btn.btn-danger').at(1);

    expect(removeBtn.text()).toBe('Remove Project');
    expect(transferBtn.text()).toBe('Transfer Project');
  });

  it('displays transfer/remove message for non-admins', function() {
    let routerContext = TestStubs.routerContext();
    routerContext.context.organization.access = ['org:read'];
    let component = mount(
      <ThemeProvider theme={theme}>
        <ProjectGeneralSettings params={{orgId: org.slug, projectId: project.slug}} />
      </ThemeProvider>,
      routerContext
    );

    expect(component.html()).toContain(
      'You do not have the required permission to remove this project.'
    );
    expect(component.html()).toContain(
      'You do not have the required permission to transfer this project.'
    );
  });
});

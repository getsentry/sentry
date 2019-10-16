import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import UserFeedbackEmpty from 'app/views/userFeedback/userFeedbackEmpty';

describe('UserFeedbackEmpty', function() {
  const routerContext = TestStubs.routerContext();
  const project = TestStubs.Project({id: '1'});
  const projectWithReports = TestStubs.Project({id: '2', hasUserReports: true});

  it('renders empty', function() {
    const organization = TestStubs.Organization();
    mountWithTheme(<UserFeedbackEmpty organization={organization} />, routerContext);
  });

  it('renders landing for project with no user feedback', function() {
    const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
    const wrapper = mountWithTheme(
      <UserFeedbackEmpty organization={organization} />,
      routerContext
    );

    expect(wrapper.find('UserFeedbackLanding').exists()).toBe(true);
  });

  it('renders warning for project with any user feedback', function() {
    const organization = TestStubs.Organization({
      projects: [projectWithReports],
    });
    const wrapper = mountWithTheme(
      <UserFeedbackEmpty organization={organization} />,
      routerContext
    );

    expect(wrapper.find('EmptyStateWarning').exists()).toBe(true);
  });

  it('renders warning for projects with any user feedback', function() {
    const organization = TestStubs.Organization({
      projects: [TestStubs.Project(), TestStubs.Project({hasUserReports: true})],
    });
    const wrapper = mountWithTheme(
      <UserFeedbackEmpty organization={organization} />,
      routerContext
    );

    expect(wrapper.find('EmptyStateWarning').exists()).toBe(true);
  });

  it('renders warning for project query with user feedback', function() {
    const organization = TestStubs.Organization({
      projects: [project, projectWithReports],
    });
    const wrapper = mountWithTheme(
      <UserFeedbackEmpty
        organization={organization}
        projectIds={[projectWithReports.id]}
      />,
      routerContext
    );

    expect(wrapper.find('EmptyStateWarning').exists()).toBe(true);
  });

  it('renders landing for project query without any user feedback', function() {
    const organization = TestStubs.Organization({
      projects: [project, projectWithReports],
    });
    const wrapper = mountWithTheme(
      <UserFeedbackEmpty organization={organization} projectIds={[project.id]} />,
      routerContext
    );

    expect(wrapper.find('UserFeedbackLanding').exists()).toBe(true);
  });

  it('renders warning for multi project query with any user feedback', function() {
    const organization = TestStubs.Organization({
      projects: [project, projectWithReports],
    });
    const wrapper = mountWithTheme(
      <UserFeedbackEmpty
        organization={organization}
        projectIds={[project.id, projectWithReports.id]}
      />,
      routerContext
    );

    expect(wrapper.find('EmptyStateWarning').exists()).toBe(true);
  });

  it('renders landing for multi project query without any user feedback', function() {
    const projectWithoutReports = TestStubs.Project({id: '3'});
    const organization = TestStubs.Organization({
      projects: [project, projectWithoutReports],
    });
    const wrapper = mountWithTheme(
      <UserFeedbackEmpty
        organization={organization}
        projectIds={[project.id, projectWithoutReports.id]}
      />,
      routerContext
    );

    expect(wrapper.find('UserFeedbackEmpty').exists()).toBe(true);
  });
});

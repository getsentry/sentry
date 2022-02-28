import {mountWithTheme} from 'sentry-test/enzyme';

import {UserFeedbackEmpty} from 'sentry/views/userFeedback/userFeedbackEmpty';

describe('UserFeedbackEmpty', function () {
  const project = TestStubs.Project({id: '1'});
  const projectWithReports = TestStubs.Project({id: '2', hasUserReports: true});
  const projectWithoutReports = TestStubs.Project({id: '3'});
  const organization = TestStubs.Organization();

  it('renders empty', function () {
    mountWithTheme(<UserFeedbackEmpty projects={[]} organization={organization} />);
  });

  it('renders landing for project with no user feedback', function () {
    const wrapper = mountWithTheme(
      <UserFeedbackEmpty projects={[project]} organization={organization} />
    );

    expect(wrapper.find('OnboardingPanel').exists()).toBe(true);
  });

  it('renders warning for project with any user feedback', function () {
    const wrapper = mountWithTheme(
      <UserFeedbackEmpty projects={[projectWithReports]} organization={organization} />
    );

    expect(wrapper.find('EmptyStateWarning').exists()).toBe(true);
  });

  it('renders warning for projects with any user feedback', function () {
    const wrapper = mountWithTheme(
      <UserFeedbackEmpty
        projects={[project, projectWithReports]}
        organization={organization}
      />
    );

    expect(wrapper.find('EmptyStateWarning').exists()).toBe(true);
  });

  it('renders warning for project query with user feedback', function () {
    const wrapper = mountWithTheme(
      <UserFeedbackEmpty
        projects={[project, projectWithReports]}
        organization={organization}
        projectIds={[projectWithReports.id]}
      />
    );

    expect(wrapper.find('EmptyStateWarning').exists()).toBe(true);
  });

  it('renders landing for project query without any user feedback', function () {
    const wrapper = mountWithTheme(
      <UserFeedbackEmpty
        projects={[project, projectWithReports]}
        organization={organization}
        projectIds={[project.id]}
      />
    );

    expect(wrapper.find('OnboardingPanel').exists()).toBe(true);
  });

  it('renders warning for multi project query with any user feedback', function () {
    const wrapper = mountWithTheme(
      <UserFeedbackEmpty
        projects={[project, projectWithReports]}
        organization={organization}
        projectIds={[project.id, projectWithReports.id]}
      />
    );

    expect(wrapper.find('EmptyStateWarning').exists()).toBe(true);
  });

  it('renders landing for multi project query without any user feedback', function () {
    const wrapper = mountWithTheme(
      <UserFeedbackEmpty
        projects={[project, projectWithoutReports]}
        organization={organization}
        projectIds={[project.id, projectWithoutReports.id]}
      />
    );

    expect(wrapper.find('UserFeedbackEmpty').exists()).toBe(true);
  });
});

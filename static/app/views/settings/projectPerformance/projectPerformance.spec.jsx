import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectPerformance from 'sentry/views/settings/projectPerformance/projectPerformance';

describe('projectPerformance', function () {
  const org = TestStubs.Organization({
    features: ['performance-view', 'performance-issues', 'performance-issues-dev'],
  });
  const project = TestStubs.ProjectDetails();
  const configUrl = '/projects/org-slug/project-slug/transaction-threshold/configure/';
  let getMock, postMock, deleteMock, issuesPutMock, performanceIssuesMock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    getMock = MockApiClient.addMockResponse({
      url: configUrl,
      method: 'GET',
      body: {
        id: project.id,
        threshold: '300',
        metric: 'duration',
      },
      statusCode: 200,
    });
    postMock = MockApiClient.addMockResponse({
      url: configUrl,
      method: 'POST',
      body: {
        id: project.id,
        threshold: '400',
        metric: 'lcp',
      },
      statusCode: 200,
    });
    deleteMock = MockApiClient.addMockResponse({
      url: configUrl,
      method: 'DELETE',
      statusCode: 200,
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: {},
      statusCode: 200,
    });
    performanceIssuesMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'GET',
      body: {
        performance_issue_creation_enabled_n_plus_one_db: true,
      },
      statusCode: 200,
    });
    issuesPutMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'PUT',
      body: {},
      statusCode: 200,
    });
  });

  it('renders the fields', function () {
    render(
      <ProjectPerformance
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
        project={project}
      />
    );

    expect(
      screen.getByRole('textbox', {name: 'Response Time Threshold (ms)'})
    ).toHaveValue('300');

    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('updates the field', function () {
    render(
      <ProjectPerformance
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
        project={project}
      />
    );

    const input = screen.getByRole('textbox', {name: 'Response Time Threshold (ms)'});

    userEvent.clear(input);
    userEvent.type(input, '400');
    userEvent.tab();

    expect(postMock).toHaveBeenCalledWith(
      configUrl,
      expect.objectContaining({
        data: {threshold: '400'},
      })
    );

    expect(input).toHaveValue('400');
  });

  it('clears the data', function () {
    render(
      <ProjectPerformance
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
        project={project}
      />
    );

    userEvent.click(screen.getByRole('button', {name: 'Reset All'}));
    expect(deleteMock).toHaveBeenCalled();
  });

  it('updates the performance issue settings when changing a boolean field', function () {
    const orgWithPerfIssuesDev = TestStubs.Organization({
      features: ['performance-view', 'performance-issues', 'performance-issues-dev'],
    });

    render(
      <ProjectPerformance
        params={{orgId: org.slug, projectId: project.slug}}
        organization={orgWithPerfIssuesDev}
        project={project}
      />
    );

    const button = screen.getByRole('checkbox', {
      name: 'Allow N+1 (db) performance issues',
    });

    userEvent.click(button);

    expect(issuesPutMock).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/performance-issues/configure/',
      expect.objectContaining({
        data: {performance_issue_creation_enabled_n_plus_one_db: false},
      })
    );
  });

  it('does not get performance issues settings without the feature flag', function () {
    const orgWithoutPerfIssues = TestStubs.Organization({
      features: ['performance-view'],
    });

    render(
      <ProjectPerformance
        params={{orgId: org.slug, projectId: project.slug}}
        organization={orgWithoutPerfIssues}
        project={project}
      />
    );

    expect(performanceIssuesMock).not.toHaveBeenCalled();
  });

  it('gets performance issues settings with the feature flag', function () {
    render(
      <ProjectPerformance
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
        project={project}
      />
    );

    expect(performanceIssuesMock).toHaveBeenCalled();
  });
});

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import * as utils from 'sentry/utils/isActiveSuperuser';
import ProjectPerformance, {
  allowedDurationValues,
} from 'sentry/views/settings/projectPerformance/projectPerformance';

describe('projectPerformance', function () {
  const org = TestStubs.Organization({
    features: [
      'performance-view',
      'performance-issues-dev',
      'project-performance-settings-admin',
    ],
  });
  const project = TestStubs.ProjectDetails();
  const configUrl = '/projects/org-slug/project-slug/transaction-threshold/configure/';
  let getMock, postMock, deleteMock, performanceIssuesMock;

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

  it('updates the field', async function () {
    render(
      <ProjectPerformance
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
        project={project}
      />
    );

    const input = screen.getByRole('textbox', {name: 'Response Time Threshold (ms)'});

    await userEvent.clear(input);
    await userEvent.type(input, '400');
    await userEvent.tab();

    expect(postMock).toHaveBeenCalledWith(
      configUrl,
      expect.objectContaining({
        data: {threshold: '400'},
      })
    );

    expect(input).toHaveValue('400');
  });

  it('clears the data', async function () {
    render(
      <ProjectPerformance
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
        project={project}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Reset All'}));
    expect(deleteMock).toHaveBeenCalled();
  });

  it('does not get performance issues settings without the feature flag', function () {
    const orgWithoutPerfIssues = TestStubs.Organization({
      features: ['performance-view', 'performance-issues-dev'],
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

  it('renders detector threshold configuration - admin ui', async function () {
    jest.spyOn(utils, 'isActiveSuperuser').mockReturnValue(true);
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'GET',
      body: {n_plus_one_db_queries_detection_enabled: false},
      statusCode: 200,
    });
    const performanceIssuesPutMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'PUT',
    });

    render(
      <ProjectPerformance
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
        project={project}
      />,
      {organization: org}
    );

    expect(
      await screen.findByText('N+1 DB Queries Detection Enabled')
    ).toBeInTheDocument();
    expect(screen.getByText('Slow DB Queries Detection Enabled')).toBeInTheDocument();

    const toggle = screen.getByRole('checkbox', {
      name: 'N+1 DB Queries Detection Enabled',
    });
    await userEvent.click(toggle);

    expect(performanceIssuesPutMock).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/performance-issues/configure/',
      expect.objectContaining({
        data: {n_plus_one_db_queries_detection_enabled: true},
      })
    );
  });

  it.each([
    {
      title: 'N+1 DB Queries',
      threshold: 'n_plus_one_db_duration_threshold',
      allowedValues: allowedDurationValues,
      defaultValue: 100,
      newValue: 500,
      newValueIndex: 5,
      sliderIndex: 1,
    },
    {
      title: 'Slow DB Queries',
      threshold: 'slow_db_query_duration_threshold',
      allowedValues: allowedDurationValues.slice(1),
      defaultValue: 1000,
      newValue: 3000,
      newValueIndex: 7,
      sliderIndex: 2,
    },
  ])(
    'renders detector thresholds settings for $title issue',
    async ({
      title,
      threshold,
      allowedValues,
      defaultValue,
      newValue,
      newValueIndex,
      sliderIndex,
    }) => {
      // Mock endpoints
      const mockGETBody = {
        [threshold]: defaultValue,
        n_plus_one_db_queries_detection_enabled: true,
        slow_db_queries_detection_enabled: true,
      };
      const performanceIssuesGetMock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/performance-issues/configure/',
        method: 'GET',
        body: mockGETBody,
        statusCode: 200,
      });
      const performanceIssuesPutMock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/performance-issues/configure/',
        method: 'PUT',
      });

      render(
        <ProjectPerformance
          params={{orgId: org.slug, projectId: project.slug}}
          organization={org}
          project={project}
        />,
        {organization: org}
      );

      expect(
        await screen.findByText('Performance Issues - Detector Threshold Settings')
      ).toBeInTheDocument();
      expect(screen.getByText(title)).toBeInTheDocument();

      const slider = screen.getAllByRole('slider')[sliderIndex];
      const indexOfValue = allowedValues.indexOf(defaultValue);

      // The value of the slider should be equal to the index
      // of the value returned from the GET method,
      // passed to it in the allowedValues array.
      expect(performanceIssuesGetMock).toHaveBeenCalled();
      expect(slider).toHaveValue(indexOfValue.toString());

      // Slide value on range slider.
      slider.focus();
      await userEvent.keyboard(`{ArrowRight>${newValueIndex - indexOfValue}}`);
      await userEvent.tab();

      expect(slider).toHaveValue(newValueIndex.toString());

      // Ensure that PUT request is fired to update
      // project settings
      const expectedPUTPayload = {};
      expectedPUTPayload[threshold] = newValue;
      expect(performanceIssuesPutMock).toHaveBeenCalledWith(
        '/projects/org-slug/project-slug/performance-issues/configure/',
        expect.objectContaining({
          data: expectedPUTPayload,
        })
      );
    }
  );

  it('test reset all detector thresholds', async function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'GET',
      body: {
        n_plus_one_db_queries_detection_enabled: true,
        slow_db_queries_detection_enabled: false,
      },
      statusCode: 200,
    });
    const endpointMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'PUT',
    });

    render(
      <ProjectPerformance
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
        project={project}
      />,
      {organization: org}
    );

    const button = await screen.findByText('Reset All Thresholds');
    expect(button).toBeInTheDocument();

    renderGlobalModal();
    await userEvent.click(button);

    // Ensure that confirm modal renders
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toBeInTheDocument();

    await userEvent.click(confirmButton);

    expect(endpointMock).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/performance-issues/configure/',
      expect.objectContaining({
        data: {
          n_plus_one_db_duration_threshold: 100,
        },
      })
    );

    // Should not be able to reset thresholds that are disabled by admin
    expect(endpointMock).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/performance-issues/configure/',
      expect.not.objectContaining({
        data: {
          slow_db_query_duration_threshold: 1000,
        },
      })
    );
  });
});

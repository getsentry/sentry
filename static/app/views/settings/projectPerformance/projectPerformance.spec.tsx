import {
  fireEvent,
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import * as utils from 'sentry/utils/isActiveSuperuser';
import ProjectPerformance, {
  allowedDurationValues,
  allowedPercentageValues,
  allowedSizeValues,
  DetectorConfigCustomer,
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

  const router = TestStubs.router();
  const routerProps = {
    router,
    location: TestStubs.location(),
    routes: router.routes,
    route: router.routes[0],
    routeParams: router.params,
  };

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
        params={{projectId: project.slug}}
        organization={org}
        project={project}
        {...routerProps}
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
        params={{projectId: project.slug}}
        organization={org}
        project={project}
        {...routerProps}
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
        params={{projectId: project.slug}}
        organization={org}
        project={project}
        {...routerProps}
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
        params={{projectId: project.slug}}
        organization={orgWithoutPerfIssues}
        project={project}
        {...routerProps}
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
        params={{projectId: project.slug}}
        organization={org}
        project={project}
        {...routerProps}
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
      threshold: DetectorConfigCustomer.N_PLUS_DB_DURATION,
      allowedValues: allowedDurationValues,
      defaultValue: 100,
      newValue: 500,
      newValueIndex: 5,
      sliderIndex: 1,
    },
    {
      title: 'Slow DB Queries',
      threshold: DetectorConfigCustomer.SLOW_DB_DURATION,
      allowedValues: allowedDurationValues.slice(1),
      defaultValue: 1000,
      newValue: 3000,
      newValueIndex: 7,
      sliderIndex: 2,
    },
    {
      title: 'Large Render Blocking Asset',
      threshold: DetectorConfigCustomer.RENDER_BLOCKING_ASSET_RATIO,
      allowedValues: allowedPercentageValues,
      defaultValue: 0.33,
      newValue: 0.5,
      newValueIndex: 6,
      sliderIndex: 3,
    },
    {
      title: 'Large HTTP Payload',
      threshold: DetectorConfigCustomer.LARGE_HTT_PAYLOAD_SIZE,
      allowedValues: allowedSizeValues.slice(1),
      defaultValue: 1000000,
      newValue: 5000000,
      newValueIndex: 13,
      sliderIndex: 4,
    },
    {
      title: 'DB on Main Thread',
      threshold: DetectorConfigCustomer.DB_ON_MAIN_THREAD_DURATION,
      allowedValues: [10, 16, 33, 50],
      defaultValue: 16,
      newValue: 33,
      newValueIndex: 2,
      sliderIndex: 5,
    },
    {
      title: 'File I/O on Main Thread',
      threshold: DetectorConfigCustomer.FILE_IO_MAIN_THREAD_DURATION,
      allowedValues: [10, 16, 33, 50],
      defaultValue: 16,
      newValue: 50,
      newValueIndex: 3,
      sliderIndex: 6,
    },
    {
      title: 'Consecutive DB Queries',
      threshold: DetectorConfigCustomer.CONSECUTIVE_DB_MIN_TIME_SAVED,
      allowedValues: allowedDurationValues.slice(0, 11),
      defaultValue: 100,
      newValue: 5000,
      newValueIndex: 10,
      sliderIndex: 7,
    },
    {
      title: 'Uncompressed Asset',
      threshold: DetectorConfigCustomer.UNCOMPRESSED_ASSET_SIZE,
      allowedValues: allowedSizeValues.slice(1),
      defaultValue: 512000,
      newValue: 700000,
      newValueIndex: 6,
      sliderIndex: 8,
    },
    {
      title: 'Uncompressed Asset',
      threshold: DetectorConfigCustomer.UNCOMPRESSED_ASSET_DURATION,
      allowedValues: allowedDurationValues.slice(1),
      defaultValue: 500,
      newValue: 400,
      newValueIndex: 3,
      sliderIndex: 9,
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
      const mockGETBody = {};
      mockGETBody[threshold] = defaultValue;
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
          params={{projectId: project.slug}}
          organization={org}
          project={project}
          {...routerProps}
        />,
        {organization: org}
      );

      expect(
        await screen.findByText('Performance Issues - Detector Threshold Settings')
      ).toBeInTheDocument();
      expect(screen.getByText(title)).toBeInTheDocument();

      // Open collapsed panels
      const chevrons = screen.getAllByTestId('form-panel-collapse-chevron');
      for (const chevron of chevrons) {
        await userEvent.click(chevron);
      }

      const slider = screen.getAllByRole('slider')[sliderIndex];
      const indexOfValue = allowedValues.indexOf(defaultValue);

      // The value of the slider should be equal to the index
      // of the value returned from the GET method,
      // passed to it in the allowedValues array.
      expect(performanceIssuesGetMock).toHaveBeenCalled();
      expect(slider).toHaveValue(indexOfValue.toString());

      // Slide value on range slider.
      fireEvent.change(slider, {target: {value: newValueIndex}});
      expect(slider).toHaveValue(newValueIndex.toString());
      fireEvent.keyUp(slider);

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
    const delete_request_mock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'DELETE',
    });

    render(
      <ProjectPerformance
        params={{projectId: project.slug}}
        organization={org}
        project={project}
        {...routerProps}
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

    expect(delete_request_mock).toHaveBeenCalled();
  });
});

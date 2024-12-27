import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {IssueTitle} from 'sentry/types/group';
import * as utils from 'sentry/utils/isActiveSuperuser';
import ProjectPerformance, {
  allowedCountValues,
  allowedDurationValues,
  allowedPercentageValues,
  allowedSizeValues,
  DetectorConfigCustomer,
} from 'sentry/views/settings/projectPerformance/projectPerformance';

describe('projectPerformance', function () {
  const org = OrganizationFixture({
    features: ['performance-view', 'performance-issues-dev'],
  });
  const project = ProjectFixture();
  const configUrl = '/projects/org-slug/project-slug/transaction-threshold/configure/';
  let getMock: jest.Mock;
  let postMock: jest.Mock;
  let deleteMock: jest.Mock;

  const router = RouterFixture();
  const routerProps = {
    router,
    location: LocationFixture(),
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
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'GET',
      body: {},
      statusCode: 200,
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance/configure/',
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
      title: IssueTitle.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
      threshold: DetectorConfigCustomer.N_PLUS_DB_DURATION,
      allowedValues: allowedDurationValues,
      defaultValue: 100,
      newValue: 500,
      sliderIndex: 1,
    },
    {
      title: IssueTitle.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
      threshold: DetectorConfigCustomer.N_PLUS_DB_COUNT,
      allowedValues: allowedCountValues,
      defaultValue: 5,
      newValue: 10,
      sliderIndex: 2,
    },
    {
      title: IssueTitle.PERFORMANCE_SLOW_DB_QUERY,
      threshold: DetectorConfigCustomer.SLOW_DB_DURATION,
      allowedValues: allowedDurationValues.slice(5),
      defaultValue: 1000,
      newValue: 3000,
      sliderIndex: 3,
    },
    {
      title: IssueTitle.PERFORMANCE_N_PLUS_ONE_API_CALLS,
      threshold: DetectorConfigCustomer.N_PLUS_API_CALLS_DURATION,
      allowedValues: allowedDurationValues.slice(5),
      defaultValue: 300,
      newValue: 500,
      sliderIndex: 4,
    },
    {
      title: IssueTitle.PERFORMANCE_RENDER_BLOCKING_ASSET,
      threshold: DetectorConfigCustomer.RENDER_BLOCKING_ASSET_RATIO,
      allowedValues: allowedPercentageValues,
      defaultValue: 0.33,
      newValue: 0.5,
      sliderIndex: 5,
    },
    {
      title: IssueTitle.PERFORMANCE_LARGE_HTTP_PAYLOAD,
      threshold: DetectorConfigCustomer.LARGE_HTT_PAYLOAD_SIZE,
      allowedValues: allowedSizeValues.slice(1),
      defaultValue: 1000000,
      newValue: 5000000,
      sliderIndex: 6,
    },
    {
      title: IssueTitle.PERFORMANCE_DB_MAIN_THREAD,
      threshold: DetectorConfigCustomer.DB_ON_MAIN_THREAD_DURATION,
      allowedValues: [10, 16, 33, 50],
      defaultValue: 16,
      newValue: 33,
      sliderIndex: 7,
    },
    {
      title: IssueTitle.PERFORMANCE_FILE_IO_MAIN_THREAD,
      threshold: DetectorConfigCustomer.FILE_IO_MAIN_THREAD_DURATION,
      allowedValues: [10, 16, 33, 50],
      defaultValue: 16,
      newValue: 50,
      sliderIndex: 8,
    },
    {
      title: IssueTitle.PERFORMANCE_CONSECUTIVE_DB_QUERIES,
      threshold: DetectorConfigCustomer.CONSECUTIVE_DB_MIN_TIME_SAVED,
      allowedValues: allowedDurationValues.slice(0, 23),
      defaultValue: 100,
      newValue: 5000,
      sliderIndex: 9,
    },
    {
      title: IssueTitle.PERFORMANCE_UNCOMPRESSED_ASSET,
      threshold: DetectorConfigCustomer.UNCOMPRESSED_ASSET_SIZE,
      allowedValues: allowedSizeValues.slice(1),
      defaultValue: 512000,
      newValue: 700000,
      sliderIndex: 10,
    },
    {
      title: IssueTitle.PERFORMANCE_UNCOMPRESSED_ASSET,
      threshold: DetectorConfigCustomer.UNCOMPRESSED_ASSET_DURATION,
      allowedValues: allowedDurationValues.slice(5),
      defaultValue: 500,
      newValue: 400,
      sliderIndex: 11,
    },
    {
      title: IssueTitle.PERFORMANCE_CONSECUTIVE_HTTP,
      threshold: DetectorConfigCustomer.CONSECUTIVE_HTTP_MIN_TIME_SAVED,
      allowedValues: allowedDurationValues.slice(14),
      defaultValue: 2000,
      newValue: 4000,
      sliderIndex: 12,
    },
  ])(
    'renders detector thresholds settings for $title issue',
    async ({title, threshold, allowedValues, defaultValue, newValue, sliderIndex}) => {
      // Mock endpoints
      const mockGETBody = {
        [threshold]: defaultValue,
        n_plus_one_db_queries_detection_enabled: true,
        slow_db_queries_detection_enabled: true,
        db_on_main_thread_detection_enabled: true,
        file_io_on_main_thread_detection_enabled: true,
        consecutive_db_queries_detection_enabled: true,
        large_render_blocking_asset_detection_enabled: true,
        uncompressed_assets_detection_enabled: true,
        large_http_payload_detection_enabled: true,
        n_plus_one_api_calls_detection_enabled: true,
        consecutive_http_spans_detection_enabled: true,
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
      const newValueIndex = allowedValues.indexOf(newValue);

      // The value of the slider should be equal to the index
      // of the value returned from the GET method,
      // passed to it in the allowedValues array.
      expect(performanceIssuesGetMock).toHaveBeenCalled();
      expect(slider).toHaveValue(indexOfValue.toString());

      // Slide value on range slider.
      act(() => slider.focus());
      const indexDelta = newValueIndex - indexOfValue;
      await userEvent.keyboard(
        indexDelta > 0 ? `{ArrowRight>${indexDelta}}` : `{ArrowLeft>${-indexDelta}}`
      );
      await userEvent.tab();

      expect(slider).toHaveValue(newValueIndex.toString());

      // Ensure that PUT request is fired to update
      // project settings
      const expectedPUTPayload: Record<string, number> = {};
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

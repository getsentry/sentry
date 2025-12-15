import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {IssueTitle} from 'sentry/types/group';
import * as utils from 'sentry/utils/isActiveSuperuser';
import ProjectPerformance, {
  allowedCountValues,
  allowedDurationValues,
  allowedPercentageValues,
  allowedSizeValues,
  DetectorConfigCustomer,
} from 'sentry/views/settings/projectPerformance/projectPerformance';

const manageDetectorData = [
  {label: 'N+1 DB Queries Detection', key: 'n_plus_one_db_queries_detection_enabled'},
  {label: 'Slow DB Queries Detection', key: 'slow_db_queries_detection_enabled'},
  {label: 'DB on Main Thread Detection', key: 'db_on_main_thread_detection_enabled'},
  {
    label: 'File I/O on Main Thread Detection',
    key: 'file_io_on_main_thread_detection_enabled',
  },
  {
    label: 'Consecutive DB Queries Detection',
    key: 'consecutive_db_queries_detection_enabled',
  },
  {
    label: 'Large Render Blocking Asset Detection',
    key: 'large_render_blocking_asset_detection_enabled',
  },
  {
    label: 'Uncompressed Assets Detection',
    key: 'uncompressed_assets_detection_enabled',
  },
  {label: 'Large HTTP Payload Detection', key: 'large_http_payload_detection_enabled'},
  {label: 'N+1 API Calls Detection', key: 'n_plus_one_api_calls_detection_enabled'},
  {
    label: 'Consecutive HTTP Detection',
    key: 'consecutive_http_spans_detection_enabled',
  },
  {
    label: 'HTTP/1.1 Overhead Detection',
    key: 'http_overhead_detection_enabled',
  },
  {label: 'Web Vitals Detection', key: 'web_vitals_detection_enabled'},
];

describe('projectPerformance', () => {
  const org = OrganizationFixture({
    features: [
      'performance-view',
      'performance-web-vitals-seer-suggestions',
      'gen-ai-features',
    ],
  });
  const project = ProjectFixture();
  const configUrl = '/projects/org-slug/project-slug/transaction-threshold/configure/';
  let getMock: jest.Mock;
  let postMock: jest.Mock;
  let deleteMock: jest.Mock;

  const initialRouterConfig = {
    routes: ['/organizations/:orgId/settings/projects/:projectId/performance/'],
    location: {
      pathname: `/organizations/${org.slug}/settings/projects/${project.slug}/performance/`,
      query: {},
    },
    params: {
      orgId: org.slug,
      projectId: project.slug,
    },
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
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
      body: project,
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
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/seer/preferences/',
      method: 'GET',
      body: {
        code_mapping_repos: [
          {provider: 'github', owner: 'owner', name: 'repo', externalId: '123'},
        ],
      },
      statusCode: 200,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      method: 'GET',
      body: {
        setupAcknowledgement: {
          orgHasAcknowledged: true,
        },
      },
    });
  });

  it('renders the fields', async () => {
    render(<ProjectPerformance />, {
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('textbox', {name: 'Response Time Threshold (ms)'})
    ).toHaveValue('300');

    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('updates the field', async () => {
    render(<ProjectPerformance />, {
      initialRouterConfig,
    });

    const input = await screen.findByRole('textbox', {
      name: 'Response Time Threshold (ms)',
    });

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

  it('clears the data', async () => {
    render(<ProjectPerformance />, {
      initialRouterConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Reset All'}));
    expect(deleteMock).toHaveBeenCalled();
  });

  it('renders detector threshold configuration - admin ui', async () => {
    jest.spyOn(utils, 'isActiveSuperuser').mockReturnValue(true);
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'GET',
      body: {transaction_duration_regression_detection_enabled: false},
      statusCode: 200,
    });
    const performanceIssuesPutMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'PUT',
    });

    render(<ProjectPerformance />, {
      organization: org,
      initialRouterConfig,
    });

    expect(
      await screen.findByText('Transaction Duration Regression Enabled')
    ).toBeInTheDocument();
    expect(screen.getByText('Function Duration Regression Enabled')).toBeInTheDocument();

    const toggle = screen.getByRole('checkbox', {
      name: 'Transaction Duration Regression Enabled',
    });
    await userEvent.click(toggle);

    expect(performanceIssuesPutMock).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/performance-issues/configure/',
      expect.objectContaining({
        data: {transaction_duration_regression_detection_enabled: true},
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
      sliderIdentifier: {
        label: 'Minimum Total Duration',
        index: 0,
      },
    },
    {
      title: IssueTitle.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
      threshold: DetectorConfigCustomer.N_PLUS_DB_COUNT,
      allowedValues: allowedCountValues,
      defaultValue: 5,
      newValue: 10,
      sliderIdentifier: {
        label: 'Minimum Query Count',
        index: 0,
      },
    },
    {
      title: IssueTitle.PERFORMANCE_SLOW_DB_QUERY,
      threshold: DetectorConfigCustomer.SLOW_DB_DURATION,
      allowedValues: allowedDurationValues.slice(5),
      defaultValue: 1000,
      newValue: 3000,
      sliderIdentifier: {
        label: 'Minimum Duration',
        index: 0,
      },
    },
    {
      title: IssueTitle.PERFORMANCE_N_PLUS_ONE_API_CALLS,
      threshold: DetectorConfigCustomer.N_PLUS_API_CALLS_DURATION,
      allowedValues: allowedDurationValues.slice(5),
      defaultValue: 300,
      newValue: 500,
      sliderIdentifier: {
        label: 'Minimum Total Duration',
        index: 1,
      },
    },
    {
      title: IssueTitle.PERFORMANCE_RENDER_BLOCKING_ASSET,
      threshold: DetectorConfigCustomer.RENDER_BLOCKING_ASSET_RATIO,
      allowedValues: allowedPercentageValues,
      defaultValue: 0.33,
      newValue: 0.5,
      sliderIdentifier: {
        label: 'Minimum FCP Ratio',
        index: 0,
      },
    },
    {
      title: IssueTitle.PERFORMANCE_LARGE_HTTP_PAYLOAD,
      threshold: DetectorConfigCustomer.LARGE_HTTP_PAYLOAD_SIZE,
      allowedValues: allowedSizeValues.slice(1),
      defaultValue: 1000000,
      newValue: 5000000,
      sliderIdentifier: {
        label: 'Minimum Size',
        index: 0,
      },
    },
    {
      title: IssueTitle.PERFORMANCE_DB_MAIN_THREAD,
      threshold: DetectorConfigCustomer.DB_ON_MAIN_THREAD_DURATION,
      allowedValues: [10, 16, 33, 50],
      defaultValue: 16,
      newValue: 33,
      sliderIdentifier: {
        label: 'Frame Rate Drop',
        index: 0,
      },
    },
    {
      title: IssueTitle.PERFORMANCE_FILE_IO_MAIN_THREAD,
      threshold: DetectorConfigCustomer.FILE_IO_MAIN_THREAD_DURATION,
      allowedValues: [10, 16, 33, 50],
      defaultValue: 16,
      newValue: 50,
      sliderIdentifier: {
        label: 'Frame Rate Drop',
        index: 1,
      },
    },
    {
      title: IssueTitle.PERFORMANCE_CONSECUTIVE_DB_QUERIES,
      threshold: DetectorConfigCustomer.CONSECUTIVE_DB_MIN_TIME_SAVED,
      allowedValues: allowedDurationValues.slice(0, 23),
      defaultValue: 100,
      newValue: 5000,
      sliderIdentifier: {
        label: 'Minimum Time Saved',
        index: 0,
      },
    },
    {
      title: IssueTitle.PERFORMANCE_UNCOMPRESSED_ASSET,
      threshold: DetectorConfigCustomer.UNCOMPRESSED_ASSET_SIZE,
      allowedValues: allowedSizeValues.slice(1),
      defaultValue: 512000,
      newValue: 700000,
      sliderIdentifier: {
        label: 'Minimum Size',
        index: 1,
      },
    },
    {
      title: IssueTitle.PERFORMANCE_UNCOMPRESSED_ASSET,
      threshold: DetectorConfigCustomer.UNCOMPRESSED_ASSET_DURATION,
      allowedValues: allowedDurationValues.slice(5),
      defaultValue: 500,
      newValue: 400,
      sliderIdentifier: {
        label: 'Minimum Duration',
        index: 1,
      },
    },
    {
      title: IssueTitle.PERFORMANCE_CONSECUTIVE_HTTP,
      threshold: DetectorConfigCustomer.CONSECUTIVE_HTTP_MIN_TIME_SAVED,
      allowedValues: allowedDurationValues.slice(14),
      defaultValue: 2000,
      newValue: 4000,
      sliderIdentifier: {
        label: 'Minimum Time Saved',
        index: 1,
      },
    },
    {
      title: IssueTitle.WEB_VITALS,
      threshold: DetectorConfigCustomer.WEB_VITALS_COUNT,
      allowedValues: allowedCountValues,
      defaultValue: 10,
      newValue: 20,
      sliderIdentifier: {
        label: 'Minimum Sample Count',
        index: 0,
      },
    },
  ])(
    'renders detector thresholds settings for $title issue',
    async ({
      title,
      threshold,
      allowedValues,
      defaultValue,
      newValue,
      sliderIdentifier,
    }) => {
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
        web_vitals_detection_enabled: true,
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

      render(<ProjectPerformance />, {
        organization: org,

        initialRouterConfig,
      });

      expect(
        await screen.findByText('Performance Issues - Detector Threshold Settings')
      ).toBeInTheDocument();
      expect(screen.getByText(title)).toBeInTheDocument();

      // Open collapsed panels
      const chevrons = screen.getAllByTestId('form-panel-collapse-chevron');
      for (const chevron of chevrons) {
        await userEvent.click(chevron);
      }

      // Some of the sliders have the same label, so use an index as well
      const slider = screen.getAllByRole('slider', {name: sliderIdentifier.label})[
        sliderIdentifier.index
      ]!;
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

  it('test reset all detector thresholds', async () => {
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

    render(<ProjectPerformance />, {
      organization: org,

      initialRouterConfig,
    });

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

  it.each(manageDetectorData)(
    'allows project admins to manage $label',
    async ({label, key}) => {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
        body: ProjectFixture({access: ['project:admin']}),
        statusCode: 200,
      });

      render(<ProjectPerformance />, {
        organization: OrganizationFixture({
          features: [
            'performance-view',
            'performance-web-vitals-seer-suggestions',
            'gen-ai-features',
          ],
        }),
        initialRouterConfig,
      });
      await screen.findByText('Performance Issues - Detector Threshold Settings');

      // Hidden by form panels being collapsed
      let toggle = screen.queryByRole<HTMLInputElement>('checkbox', {name: label});
      expect(toggle).not.toBeInTheDocument();

      const chevrons = screen.getAllByTestId('form-panel-collapse-chevron');
      for (const chevron of chevrons) {
        await userEvent.click(chevron);
      }

      const mockPut = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/performance-issues/configure/',
        method: 'PUT',
      });

      // Enabled by default
      toggle = screen.getByRole<HTMLInputElement>('checkbox', {name: label});
      expect(toggle).toBeChecked();

      // Disable the detector
      await userEvent.click(toggle);
      expect(mockPut).toHaveBeenCalledWith(
        '/projects/org-slug/project-slug/performance-issues/configure/',
        expect.objectContaining({
          data: {
            [key]: false,
          },
        })
      );
      mockPut.mockClear();
      expect(toggle).not.toBeChecked();

      // Re-enable the detector
      await userEvent.click(toggle);
      expect(mockPut).toHaveBeenCalledWith(
        '/projects/org-slug/project-slug/performance-issues/configure/',
        expect.objectContaining({
          data: {
            [key]: true,
          },
        })
      );
      expect(toggle).toBeChecked();
    }
  );

  it.each(manageDetectorData)(
    'does not allow non-admins to manage $label',
    async ({label}) => {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
        body: ProjectFixture({access: ['project:read']}),
        statusCode: 200,
      });

      render(<ProjectPerformance />, {
        organization: OrganizationFixture({
          features: [
            'performance-view',
            'performance-web-vitals-seer-suggestions',
            'gen-ai-features',
          ],
          access: ['project:read'],
        }),
        initialRouterConfig,
      });

      await screen.findByText('Performance Issues - Detector Threshold Settings');

      let toggle = screen.queryByRole<HTMLInputElement>('checkbox', {name: label});
      expect(toggle).not.toBeInTheDocument();

      const chevrons = screen.getAllByTestId('form-panel-collapse-chevron');
      for (const chevron of chevrons) {
        await userEvent.click(chevron);
      }

      toggle = screen.queryByRole<HTMLInputElement>('checkbox', {name: label});
      expect(toggle).toBeDisabled();
    }
  );
});

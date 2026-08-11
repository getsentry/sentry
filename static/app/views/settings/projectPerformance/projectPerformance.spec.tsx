import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {IssueTitle} from 'sentry/types/group';
import {DynamicSamplingBiasType} from 'sentry/types/sampling';
import {trackAnalytics} from 'sentry/utils/analytics';
import * as utils from 'sentry/utils/isActiveSuperuser';
import {ProjectPerformance} from 'sentry/views/settings/projectPerformance';

import {
  allowedCountValues,
  allowedDurationValues,
  allowedPercentageValues,
  allowedSizeValues,
} from './detectors/detectorFieldGroups';
import {DetectorConfigCustomer} from './detectors/detectorSettings';

jest.mock('sentry/utils/analytics');

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

async function expandAllDetectorSettings() {
  const detectorSettings = document.getElementById('detector-threshold-settings');
  if (!detectorSettings) {
    throw new Error('Detector settings were not rendered');
  }

  const collapsedGroups = within(detectorSettings).queryAllByRole('button', {
    expanded: false,
  });
  for (const group of collapsedGroups) {
    await userEvent.click(group);
  }
}

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

  const initialRouterConfig = {
    routes: ['/settings/:orgId/projects/:projectId/performance/'],
    location: {
      pathname: `/settings/${org.slug}/projects/${project.slug}/performance/`,
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
    MockApiClient.addMockResponse({
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
      body: {},
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

  it('keeps sampling priority forms synchronized after saves', async () => {
    let dynamicSamplingBiases = [
      {id: DynamicSamplingBiasType.BOOST_LATEST_RELEASES, active: false},
      {id: DynamicSamplingBiasType.BOOST_ENVIRONMENTS, active: false},
      {id: DynamicSamplingBiasType.BOOST_LOW_VOLUME_TRANSACTIONS, active: false},
      {id: DynamicSamplingBiasType.IGNORE_HEALTH_CHECKS, active: false},
      {id: DynamicSamplingBiasType.MINIMUM_SAMPLE_RATE, active: true},
    ];
    const detailedProject = {...ProjectFixture(), dynamicSamplingBiases};
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: () => ({...detailedProject, dynamicSamplingBiases}),
    });
    const firstUpdate = Promise.withResolvers<typeof detailedProject>();
    let updateCount = 0;
    const projectPutMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: (
        _url: string,
        options: {data: {dynamicSamplingBiases: typeof dynamicSamplingBiases}}
      ) => {
        dynamicSamplingBiases = options.data.dynamicSamplingBiases;
        const projectResponse = {...detailedProject, dynamicSamplingBiases};
        updateCount += 1;
        if (updateCount === 1) {
          return firstUpdate.promise;
        }
        return projectResponse;
      },
    });

    render(<ProjectPerformance />, {
      organization: OrganizationFixture({features: ['dynamic-sampling']}),
      initialRouterConfig,
    });

    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'Prioritize new releases'})
    );
    await waitFor(() => {
      expect(projectPutMock).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole('checkbox', {name: 'Prioritize dev environments'})
      ).toBeDisabled();
    });

    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Prioritize dev environments'})
    );
    expect(projectPutMock).toHaveBeenCalledTimes(1);

    firstUpdate.resolve({...detailedProject, dynamicSamplingBiases});
    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', {name: 'Prioritize new releases'})
      ).toBeChecked();
      expect(
        screen.getByRole('checkbox', {name: 'Prioritize dev environments'})
      ).toBeEnabled();
    });

    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Prioritize dev environments'})
    );

    await waitFor(() => {
      expect(projectPutMock).toHaveBeenLastCalledWith(
        '/projects/org-slug/project-slug/',
        expect.objectContaining({
          data: {
            dynamicSamplingBiases: expect.arrayContaining([
              {id: DynamicSamplingBiasType.BOOST_LATEST_RELEASES, active: true},
              {id: DynamicSamplingBiasType.BOOST_ENVIRONMENTS, active: true},
              {id: DynamicSamplingBiasType.MINIMUM_SAMPLE_RATE, active: true},
            ]),
          },
        })
      );
    });
  });

  it('shows sampling priority save errors', async () => {
    const dynamicSamplingBiases = [
      {id: DynamicSamplingBiasType.BOOST_LATEST_RELEASES, active: false},
      {id: DynamicSamplingBiasType.BOOST_ENVIRONMENTS, active: false},
      {id: DynamicSamplingBiasType.BOOST_LOW_VOLUME_TRANSACTIONS, active: false},
      {id: DynamicSamplingBiasType.IGNORE_HEALTH_CHECKS, active: false},
    ];
    const detailedProject = {...ProjectFixture(), dynamicSamplingBiases};
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: detailedProject,
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: {detail: 'Failed to save'},
      statusCode: 500,
    });

    render(<ProjectPerformance />, {
      organization: OrganizationFixture({features: ['dynamic-sampling']}),
      initialRouterConfig,
    });

    const prioritySwitch = await screen.findByRole('checkbox', {
      name: 'Prioritize new releases',
    });
    await userEvent.click(prioritySwitch);

    expect(await screen.findByText('Failed to save')).toBeInTheDocument();
    expect(prioritySwitch).not.toBeChecked();
  });

  it('resets threshold settings', async () => {
    const initialThreshold = {
      id: project.id,
      threshold: '300',
      metric: 'duration',
    };
    let currentThreshold = initialThreshold;
    const thresholdGetMock = MockApiClient.addMockResponse({
      url: configUrl,
      method: 'GET',
      body: () => currentThreshold,
    });
    const thresholdPostMock = MockApiClient.addMockResponse({
      url: configUrl,
      method: 'POST',
      body: (_url: string, options: {data: Partial<typeof currentThreshold>}) => {
        currentThreshold = {...currentThreshold, ...options.data};
        return currentThreshold;
      },
    });
    const thresholdDeleteMock = MockApiClient.addMockResponse({
      url: configUrl,
      method: 'DELETE',
      body: () => {
        currentThreshold = initialThreshold;
        return {};
      },
    });

    render(<ProjectPerformance />, {
      initialRouterConfig,
    });

    await selectEvent.select(
      await screen.findByText('Transaction Duration'),
      'Largest Contentful Paint'
    );
    await waitFor(() => {
      expect(thresholdPostMock).toHaveBeenCalledWith(
        configUrl,
        expect.objectContaining({data: {metric: 'lcp'}})
      );
    });

    const input = await screen.findByRole('textbox', {
      name: 'Response Time Threshold (ms)',
    });
    await userEvent.clear(input);
    await userEvent.type(input, '400');
    await userEvent.tab();
    await waitFor(() => {
      expect(thresholdPostMock).toHaveBeenCalledWith(
        configUrl,
        expect.objectContaining({data: {threshold: '400'}})
      );
      expect(
        screen.getByRole('textbox', {name: 'Response Time Threshold (ms)'})
      ).toHaveValue('400');
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Reset All'}));

    await waitFor(() => {
      expect(thresholdDeleteMock).toHaveBeenCalled();
      expect(thresholdGetMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Transaction Duration')).toBeInTheDocument();
      expect(
        screen.getByRole('textbox', {name: 'Response Time Threshold (ms)'})
      ).toHaveValue('300');
    });
  });

  it('serializes metric and threshold updates', async () => {
    const firstUpdate = Promise.withResolvers<{
      id: string;
      metric: string;
      threshold: string;
    }>();
    let updateCount = 0;
    const thresholdPostMock = MockApiClient.addMockResponse({
      url: configUrl,
      method: 'POST',
      body: () => {
        updateCount += 1;
        return updateCount === 1
          ? firstUpdate.promise
          : {id: project.id, metric: 'lcp', threshold: '400'};
      },
    });

    render(<ProjectPerformance />, {initialRouterConfig});

    await selectEvent.select(
      await screen.findByText('Transaction Duration'),
      'Largest Contentful Paint'
    );
    await waitFor(() => expect(thresholdPostMock).toHaveBeenCalledTimes(1));

    const input = screen.getByRole('textbox', {
      name: 'Response Time Threshold (ms)',
    });
    await userEvent.clear(input);
    await userEvent.type(input, '400');
    await userEvent.tab();

    expect(thresholdPostMock).toHaveBeenCalledTimes(1);

    firstUpdate.resolve({id: project.id, metric: 'lcp', threshold: '300'});

    await waitFor(() => expect(thresholdPostMock).toHaveBeenCalledTimes(2));
    expect(thresholdPostMock).toHaveBeenLastCalledWith(
      configUrl,
      expect.objectContaining({data: {threshold: '400'}})
    );
  });

  it('prevents threshold edits from racing with reset', async () => {
    const save = Promise.withResolvers<{
      id: string;
      metric: string;
      threshold: string;
    }>();
    const thresholdPostMock = MockApiClient.addMockResponse({
      url: configUrl,
      method: 'POST',
      body: () => save.promise,
    });
    const pendingReset = Promise.withResolvers<Record<string, never>>();
    const thresholdDeleteMock = MockApiClient.addMockResponse({
      url: configUrl,
      method: 'DELETE',
      body: () => pendingReset.promise,
    });

    render(<ProjectPerformance />, {initialRouterConfig});

    const input = await screen.findByRole('textbox', {
      name: 'Response Time Threshold (ms)',
    });
    const resetButton = screen.getByRole('button', {name: 'Reset All'});

    await userEvent.clear(input);
    await userEvent.type(input, '400');
    await userEvent.tab();

    expect(thresholdPostMock).toHaveBeenCalled();
    expect(resetButton).toBeDisabled();

    save.resolve({id: project.id, metric: 'duration', threshold: '400'});
    await waitFor(() => expect(resetButton).toBeEnabled());

    await userEvent.click(resetButton);

    expect(thresholdDeleteMock).toHaveBeenCalled();
    expect(input).toBeDisabled();
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

  it('disables admin detector settings without project write access', async () => {
    jest.spyOn(utils, 'isActiveSuperuser').mockReturnValue(true);
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: ProjectFixture({access: ['project:read']}),
      statusCode: 200,
    });

    render(<ProjectPerformance />, {
      organization: OrganizationFixture({
        access: ['org:read'],
        features: org.features,
      }),
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('checkbox', {
        name: 'Transaction Duration Regression Enabled',
      })
    ).toBeDisabled();
    expect(
      screen.getByRole('checkbox', {name: 'Function Duration Regression Enabled'})
    ).toBeDisabled();
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
      await expandAllDetectorSettings();

      // Some of the sliders have the same label, so use an index as well
      const slider = screen
        .getAllByRole('slider', {name: sliderIdentifier.label})
        .at(sliderIdentifier.index);
      if (!slider) {
        throw new Error(`Slider ${sliderIdentifier.index} was not rendered`);
      }
      const indexOfValue = allowedValues.indexOf(defaultValue);
      const newValueIndex = allowedValues.indexOf(newValue);

      // The value of the slider should be equal to the index
      // of the value returned from the GET method,
      // passed to it in the allowedValues array.
      expect(performanceIssuesGetMock).toHaveBeenCalled();
      expect(slider).toHaveValue(indexOfValue.toString());

      // Slide value on range slider.
      await userEvent.click(slider);
      const indexDelta = newValueIndex - indexOfValue;
      for (let index = 0; index < Math.abs(indexDelta); index++) {
        await userEvent.keyboard(indexDelta > 0 ? '{ArrowRight}' : '{ArrowLeft}');
      }
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
      expect(trackAnalytics).toHaveBeenCalledWith(
        'performance_views.project_issue_detection_threshold_changed',
        {
          organization: org,
          project_slug: project.slug,
          threshold_key: threshold,
          threshold_value: newValue,
        }
      );
    }
  );

  it('positions detector sliders at nonstandard configured values', async () => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'GET',
      body: {
        http_overhead_detection_enabled: true,
        http_request_delay_threshold: 2500,
      },
      statusCode: 200,
    });

    render(<ProjectPerformance />, {
      organization: org,
      initialRouterConfig,
    });
    await screen.findByText('Performance Issues - Detector Threshold Settings');
    await expandAllDetectorSettings();

    expect(screen.getByRole('slider', {name: 'Request Delay'})).toHaveValue('11');
  });

  it('resets configurable detector settings', async () => {
    let aiDetectedHttpEnabled = true;
    const performanceIssuesGetMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'GET',
      body: () => ({
        ai_issue_detection_enabled: true,
        ai_detected_http_enabled: aiDetectedHttpEnabled,
      }),
      statusCode: 200,
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'PUT',
      body: (_url: string, options: {data: Record<string, boolean>}) => {
        aiDetectedHttpEnabled = options.data.ai_detected_http_enabled ?? true;
        return {};
      },
    });
    const reset = Promise.withResolvers<Record<string, never>>();
    const delete_request_mock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'DELETE',
      body: () => reset.promise,
    });

    render(<ProjectPerformance />, {
      organization: OrganizationFixture({
        features: [
          'performance-view',
          'performance-web-vitals-seer-suggestions',
          'gen-ai-features',
          'ai-issue-detection',
        ],
      }),
      initialRouterConfig,
    });

    const button = await screen.findByText('Reset All Thresholds');
    expect(button).toBeInTheDocument();

    await expandAllDetectorSettings();
    const detectorSwitch = screen.getByRole('checkbox', {
      name: 'HTTP Issues',
    });
    expect(detectorSwitch).toBeChecked();

    await userEvent.click(detectorSwitch);
    expect(detectorSwitch).not.toBeChecked();

    renderGlobalModal();
    await userEvent.click(button);

    // Ensure that confirm modal renders
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toBeInTheDocument();

    await userEvent.click(confirmButton);

    expect(delete_request_mock).toHaveBeenCalled();
    expect(detectorSwitch).toBeDisabled();

    aiDetectedHttpEnabled = true;
    reset.resolve({});

    await waitFor(() => {
      expect(performanceIssuesGetMock).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('checkbox', {name: 'HTTP Issues'})).toBeChecked();
    });
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

      await expandAllDetectorSettings();

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

  it('disables detector thresholds while the detector update is pending', async () => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: ProjectFixture({access: ['project:admin']}),
      statusCode: 200,
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'GET',
      body: {
        n_plus_one_db_queries_detection_enabled: true,
        n_plus_one_db_duration_threshold: 100,
      },
      statusCode: 200,
    });
    const pendingUpdate = Promise.withResolvers<Record<string, boolean>>();
    const mockPut = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'PUT',
      body: () => pendingUpdate.promise,
    });

    render(<ProjectPerformance />, {
      organization: org,
      initialRouterConfig,
    });
    await screen.findByText('Performance Issues - Detector Threshold Settings');
    await expandAllDetectorSettings();

    const toggle = screen.getByRole('checkbox', {name: 'N+1 DB Queries Detection'});
    const threshold = screen.getAllByRole('slider', {
      name: 'Minimum Total Duration',
    })[0];
    if (!threshold) {
      throw new Error('Minimum Total Duration slider was not rendered');
    }
    expect(threshold).toBeEnabled();

    await userEvent.click(toggle);

    expect(mockPut).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/performance-issues/configure/',
      expect.objectContaining({
        data: {n_plus_one_db_queries_detection_enabled: false},
      })
    );
    expect(threshold).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Reset All Thresholds'})).toBeDisabled();
  });

  it('serializes detector updates that share the settings resource', async () => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: ProjectFixture({access: ['project:admin']}),
      statusCode: 200,
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'GET',
      body: {
        n_plus_one_db_queries_detection_enabled: true,
        slow_db_queries_detection_enabled: true,
      },
      statusCode: 200,
    });
    const firstUpdate = Promise.withResolvers<Record<string, boolean>>();
    let updateCount = 0;
    const mockPut = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/performance-issues/configure/',
      method: 'PUT',
      body: (_url: string, options: {data: Record<string, boolean>}) => {
        updateCount += 1;
        if (updateCount === 1) {
          return firstUpdate.promise;
        }
        return options.data;
      },
    });

    render(<ProjectPerformance />, {
      organization: org,
      initialRouterConfig,
    });
    await screen.findByText('Performance Issues - Detector Threshold Settings');
    await expandAllDetectorSettings();

    await userEvent.click(
      screen.getByRole('checkbox', {name: 'N+1 DB Queries Detection'})
    );
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Slow DB Queries Detection'})
    );

    expect(mockPut).toHaveBeenCalledTimes(1);

    firstUpdate.resolve({n_plus_one_db_queries_detection_enabled: false});

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledTimes(2);
    });
    expect(mockPut).toHaveBeenNthCalledWith(
      2,
      '/projects/org-slug/project-slug/performance-issues/configure/',
      expect.objectContaining({data: {slow_db_queries_detection_enabled: false}})
    );
  });

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

      await expandAllDetectorSettings();

      toggle = screen.queryByRole<HTMLInputElement>('checkbox', {name: label});
      expect(toggle).toBeDisabled();
    }
  );
});

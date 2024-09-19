import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SlowestFunctionsTable} from 'sentry/views/profiling/landing/slowestFunctionsTable';

describe('SlowestFunctionsTable', () => {
  it('shows loading state', () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/profiling/flamegraph/',
      body: [],
    });

    render(<SlowestFunctionsTable />);
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('shows error state', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/profiling/flamegraph/',
      body: [],
      statusCode: 500,
    });

    render(<SlowestFunctionsTable />);
    expect(await screen.findByTestId('error-indicator')).toBeInTheDocument();
  });

  it('shows no functions state', async () => {
    // @ts-expect-error partial schema mock
    const schema: Profiling.Schema = {
      metrics: [],
    };

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/profiling/flamegraph/',
      match: [
        MockApiClient.matchQuery({
          expand: 'metrics',
        }),
      ],
      body: schema,
    });

    render(<SlowestFunctionsTable />);
    expect(await screen.findByText('No functions found')).toBeInTheDocument();
  });
  it('renders function fields', async () => {
    // @ts-expect-error partial schema mock
    const schema: Profiling.Schema = {
      metrics: [
        {
          name: 'slow-function',
          package: 'slow-package',
          p75: 1500 * 1e6,
          p95: 2000 * 1e6,
          p99: 3000 * 1e6,
          sum: 60_000 * 1e6,
          count: 5000,
          avg: 0.5 * 1e6,
          in_app: true,
          fingerprint: 12345,
          examples: [
            {
              project_id: 1,
              profile_id: 'profile-id',
            },
          ],
        },
      ],
    };

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/profiling/flamegraph/',
      match: [
        MockApiClient.matchQuery({
          expand: 'metrics',
        }),
      ],
      body: schema,
    });

    render(<SlowestFunctionsTable />);
    for (const value of ['slow-function', 'slow-package', '1.50s', '2.00s', '3.00s']) {
      expect(await screen.findByText(value)).toBeInTheDocument();
    }
  });
  it('paginates response', async () => {
    // @ts-expect-error partial schema mock
    const schema: Profiling.Schema = {
      metrics: [],
    };

    for (let i = 0; i < 10; i++) {
      schema.metrics?.push({
        name: 'slow-function',
        package: 'slow-package',
        p75: 1500 * 1e6,
        p95: 2000 * 1e6,
        p99: 3000 * 1e6,
        sum: 60_000 * 1e6,
        count: 5000,
        avg: 0.5 * 1e6,
        in_app: true,
        fingerprint: 12345,
        examples: [
          {
            project_id: 1,
            profile_id: 'profile-id',
          },
        ],
      });
    }

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/profiling/flamegraph/',
      match: [
        MockApiClient.matchQuery({
          expand: 'metrics',
        }),
      ],
      body: schema,
    });

    render(<SlowestFunctionsTable />);

    expect(await screen.findAllByText('slow-function')).toHaveLength(5);
  });

  it('paginates results', async () => {
    // @ts-expect-error partial schema mock
    const schema: Profiling.Schema = {
      metrics: [],
    };

    for (let i = 0; i < 10; i++) {
      schema.metrics?.push({
        name: 'slow-function-' + i,
        package: 'slow-package',
        p75: 1500 * 1e6,
        p95: 2000 * 1e6,
        p99: 3000 * 1e6,
        sum: 60_000 * 1e6,
        count: 5000,
        avg: 0.5 * 1e6,
        in_app: true,
        fingerprint: 12345,
        examples: [
          {
            project_id: 1,
            profile_id: 'profile-id',
          },
        ],
      });
    }

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/profiling/flamegraph/',
      match: [
        MockApiClient.matchQuery({
          expand: 'metrics',
        }),
      ],
      body: schema,
    });

    render(<SlowestFunctionsTable />);
    expect(await screen.findAllByText('slow-package')).toHaveLength(5);

    await userEvent.click(screen.getByLabelText('Next'));
    for (let i = 6; i < 10; i++) {
      expect(await screen.findByText('slow-function-' + i)).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Next')).toBeDisabled();

    await userEvent.click(screen.getByLabelText('Previous'));
    for (let i = 0; i < 5; i++) {
      expect(await screen.findByText('slow-function-' + i)).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Previous')).toBeDisabled();
  });
  it('fetches function metrics', async () => {
    // @ts-expect-error partial schema mock
    const schema: Profiling.Schema = {
      metrics: [],
    };

    for (let i = 0; i < 10; i++) {
      schema.metrics?.push({
        name: 'slow-function-' + i,
        package: 'slow-package',
        p75: 1500 * 1e6,
        p95: 2000 * 1e6,
        p99: 3000 * 1e6,
        sum: 60_000 * 1e6,
        count: 5000,
        avg: 0.5 * 1e6,
        in_app: true,
        fingerprint: 12345,
        examples: [
          {
            project_id: 1,
            profile_id: 'profile-id',
          },
        ],
      });
    }

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/profiling/flamegraph/',
      match: [
        MockApiClient.matchQuery({
          expand: 'metrics',
        }),
      ],
      body: schema,
    });

    const functionMetricsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      match: [
        MockApiClient.matchQuery({
          query: 'fingerprint:12345',
          dataset: 'profileFunctionsMetrics',
        }),
      ],
      body: [],
    });

    render(<SlowestFunctionsTable />);

    const expandButtons = await screen.findAllByLabelText('View Function Metrics');
    expect(expandButtons).toHaveLength(5);

    await userEvent.click(expandButtons[0]);
    await waitFor(() => {
      expect(functionMetricsRequest).toHaveBeenCalled();
    });
  });
});

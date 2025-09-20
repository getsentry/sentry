import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DynamicSamplingPanel} from 'admin/views/dynamicSamplingPanel';

const devEnvRule = {
  samplingValue: {
    type: 'sampleRate',
    value: 1.0,
  },
  type: 'trace',
  condition: {
    op: 'or',
    inner: [
      {
        op: 'glob',
        name: 'trace.environment',
        value: ['*debug*', '*dev*', '*local*', '*qa*', '*test*'],
      },
    ],
  },
  id: 1001,
};

function mockProjectConfigResponse(projectId: string, configs: Record<string, unknown>) {
  return MockApiClient.addMockResponse({
    url: `/internal/project-config/?projectId=${projectId}`,
    body: {
      configs,
    },
  });
}

describe('Dynamic Sampling Panel', () => {
  it('renders dynamic sampling rules', async () => {
    const {project} = initializeOrg();

    mockProjectConfigResponse(project.id, {
      'proj key 1': null,
      'proj key 2': {
        config: {
          sampling: {
            rules: [devEnvRule],
          },
        },
      },
    });
    render(<DynamicSamplingPanel projectId={project.id} />);

    expect(await screen.findByText('Dynamic Sampling Rules')).toBeInTheDocument();

    const emptyTableMsg = screen.queryByText('No dynamic sampling rules to display');
    expect(emptyTableMsg).not.toBeInTheDocument();

    expect(screen.getByText('Boost Environments')).toBeInTheDocument();
    expect(screen.getByText('Sample Rate')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('loads data from the region API', async () => {
    const {project, organization} = initializeOrg();

    const mockGet = mockProjectConfigResponse(project.id, {
      'proj key 1': null,
      'proj key 2': {
        config: {
          sampling: {
            rules: [devEnvRule],
          },
        },
      },
    });
    render(<DynamicSamplingPanel projectId={project.id} organization={organization} />);

    expect(await screen.findByText('Dynamic Sampling Rules')).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith(
      `/internal/project-config/?projectId=${project.id}`,
      expect.objectContaining({
        host: 'https://us.sentry.io',
      })
    );
    expect(screen.getByText('Boost Environments')).toBeInTheDocument();
    expect(screen.getByText('Sample Rate')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();

    const rawConfig = screen.getByTestId('raw-project-config');
    expect(rawConfig).toHaveAttribute(
      'href',
      expect.stringContaining('https://us.sentry.io')
    );
  });

  it('renders empty table if there is no valid config', async () => {
    const {project} = initializeOrg();

    mockProjectConfigResponse(project.id, {
      'proj key 1': null,
    });

    render(<DynamicSamplingPanel projectId={project.id} />);

    expect(await screen.findByText('Dynamic Sampling Rules')).toBeInTheDocument();

    const emptyTableMsg = screen.queryByText('No dynamic sampling rules to display');
    expect(emptyTableMsg).toBeInTheDocument();
  });

  it('renders empty table if config does not contain dynamic sampling', async () => {
    const {project} = initializeOrg();

    mockProjectConfigResponse(project.id, {
      'proj key 1': {config: {}},
    });

    render(<DynamicSamplingPanel projectId={project.id} />);

    expect(await screen.findByText('Dynamic Sampling Rules')).toBeInTheDocument();

    const emptyTableMsg = screen.queryByText('No dynamic sampling rules to display');
    expect(emptyTableMsg).toBeInTheDocument();
  });

  it('renders empty table if dynamic sampling config is empty', async () => {
    const {project} = initializeOrg();

    mockProjectConfigResponse(project.id, {
      'proj key 1': {
        config: {
          sampling: {
            rules: [],
          },
        },
      },
    });

    render(<DynamicSamplingPanel projectId={project.id} />);

    expect(await screen.findByText('Dynamic Sampling Rules')).toBeInTheDocument();

    const emptyTableMsg = screen.queryByText('No dynamic sampling rules to display');
    expect(emptyTableMsg).toBeInTheDocument();
  });

  it('renders conditions like in the discover search bar', async () => {
    const {project} = initializeOrg();

    const rule1 = {
      samplingValue: {
        type: 'reservoir',
        limit: 100,
      },
      type: 'transaction',
      id: 3005,
      condition: {
        op: 'and',
        inner: [],
      },
      timeRange: {
        start: '2024-06-19T09:03:31.990170Z',
        end: '2024-06-21T09:03:31.990170Z',
      },
    };

    const rule2 = {
      samplingValue: {
        type: 'reservoir',
        limit: 300,
      },
      type: 'transaction',
      id: 3001,
      condition: {
        op: 'gt',
        name: 'event.duration',
        value: 1000,
      },
      timeRange: {
        start: '2024-06-20T13:25:35.098005Z',
        end: '2024-06-22T13:25:35.098005Z',
      },
    };

    const rule3 = {
      samplingValue: {
        type: 'sampleRate',
        value: 1,
      },
      type: 'trace',
      condition: {
        op: 'not',
        inner: {
          op: 'eq',
          name: 'trace.replay_id',
          value: null,
          options: {
            ignoreCase: true,
          },
        },
      },
      id: 1005,
    };

    const rule4 = {
      samplingValue: {
        type: 'sampleRate',
        value: 1,
      },
      type: 'trace',
      condition: {
        op: 'or',
        inner: [
          {
            op: 'glob',
            name: 'trace.environment',
            value: ['*debug*', '*dev*', '*local*', '*qa*', '*test*'],
          },
        ],
      },
      id: 1001,
    };

    const rule5 = {
      samplingValue: {
        type: 'factor',
        value: 1.4433320526131683,
      },
      type: 'trace',
      condition: {
        op: 'and',
        inner: [
          {
            op: 'eq',
            name: 'trace.release',
            value: ['frontend@db94621a53bf3e2f3924b2d26b31d5ef5b74d18f'],
          },
          {
            op: 'eq',
            name: 'trace.environment',
            value: 'prod',
          },
        ],
      },
      id: 1500,
      timeRange: {
        start: '2024-06-20T12:38:21Z',
        end: '2024-06-20T15:42:16Z',
      },
      decayingFn: {
        type: 'linear',
        decayedValue: 1,
      },
    };

    mockProjectConfigResponse(project.id, {
      'proj key 1': {
        config: {
          sampling: {
            rules: [rule1, rule2, rule3, rule4, rule5],
          },
        },
      },
    });

    render(<DynamicSamplingPanel projectId={project.id} />);

    expect(await screen.findByText('Dynamic Sampling Rules')).toBeInTheDocument();

    // Equivalent of the conditions of rule1
    expect(screen.getByText('<all>')).toBeInTheDocument();

    // Equivalent of the conditions of rule2
    expect(screen.getByText('event.duration:>1000')).toBeInTheDocument();

    // Equivalent of the conditions of rule3
    expect(screen.getByText('!trace.replay_id:null')).toBeInTheDocument();

    // Equivalent of the conditions of rule4
    expect(
      screen.getByText('trace.environment:["*debug*","*dev*","*local*","*qa*","*test*"]')
    ).toBeInTheDocument();

    // Equivalent of the conditions of rule5
    expect(
      screen.getByText(
        'trace.release:["frontend@db94621a53bf3e2f3924b2d26b31d5ef5b74d18f"] AND trace.environment:"prod"'
      )
    ).toBeInTheDocument();

    // Check that the time range is displayed if available
    const timeRanges = screen.queryAllByTestId('timerange');
    expect(timeRanges[0]).toHaveTextContent('Start:Jun 19, 2024 9:03 AM');
    expect(timeRanges[0]).toHaveTextContent('End:Jun 21, 2024 9:03 AM');

    // Check that the limit is displayed if available
    const limits = screen.queryAllByTestId('limit');
    expect(limits[0]).toHaveTextContent('Limit:100');
  });
});

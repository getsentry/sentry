import {Project as ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {SlowestFunctionsWidget} from 'sentry/views/profiling/landing/slowestFunctionsWidget';

describe('SlowestFunctionsWidget', function () {
  beforeEach(function () {
    const project = ProjectFixture({
      id: '1',
      slug: 'proj-slug',
    });

    ProjectsStore.loadInitialData([project]);
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders errors', async function () {
    // return 400 for all queries
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      statusCode: 400,
    });

    render(<SlowestFunctionsWidget widgetHeight="100px" />);

    // starts by rendering loading
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // switches to errors once the api responds with an error
    expect(await screen.findByTestId('error-indicator')).toBeInTheDocument();
  });

  it('renders no functions', async function () {
    // for the slowest functions query
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [],
      },
      match: [
        MockApiClient.matchQuery({
          dataset: 'profileFunctions',
          field: ['project.id', 'fingerprint', 'package', 'function', 'count()', 'sum()'],
        }),
      ],
    });

    render(<SlowestFunctionsWidget widgetHeight="100px" />);

    // starts by rendering loading
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // switches to the no functions view
    expect(await screen.findByText('No functions found')).toBeInTheDocument();
  });

  it('renders example transactions', async function () {
    // for the slowest functions query
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'project.id': 1,
            fingerprint: 123,
            package: 'foo',
            function: 'bar',
            'sum()': 150,
          },
          {
            'project.id': 1,
            fingerprint: 456,
            package: 'baz',
            function: 'qux',
            'sum()': 100,
          },
        ],
      },
      match: [
        MockApiClient.matchQuery({
          dataset: 'profileFunctions',
          field: ['project.id', 'fingerprint', 'package', 'function', 'count()', 'sum()'],
        }),
      ],
    });

    // for the totals query
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'project.id': 1, 'sum()': 2500000}]},
      match: [
        MockApiClient.matchQuery({
          dataset: 'profileFunctions',
          field: ['project.id', 'sum()'],
          project: [1],
        }),
      ],
    });

    // first function examples
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            transaction: 'transaction-1',
            'count()': 1000,
            'p75()': 100000,
            'sum()': 1000000,
            'examples()': [
              'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            ],
          },
          {
            transaction: 'transaction-2',
            'count()': 2500,
            'p75()': 50000,
            'sum()': 500000,
            'examples()': ['cccccccccccccccccccccccccccccccc'],
          },
        ],
      },
      match: [
        MockApiClient.matchQuery({
          dataset: 'profileFunctions',
          query: 'project.id:1 fingerprint:123',
          field: ['transaction', 'count()', 'p75()', 'sum()', 'examples()'],
        }),
      ],
    });

    // second function examples
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            transaction: 'transaction-3',
            'count()': 2000,
            'p75()': 200000,
            'sum()': 2000000,
            'examples()': [
              'dddddddddddddddddddddddddddddddd',
              'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            ],
          },
          {
            transaction: 'transaction-4',
            'count()': 3500,
            'p75()': 70000,
            'sum()': 700000,
            'examples()': ['ffffffffffffffffffffffffffffffff'],
          },
        ],
      },
      match: [
        MockApiClient.matchQuery({
          dataset: 'profileFunctions',
          query: 'project.id:1 fingerprint:456',
          field: ['transaction', 'count()', 'p75()', 'sum()', 'examples()'],
        }),
      ],
    });

    render(<SlowestFunctionsWidget widgetHeight="100px" />);

    // starts by rendering loading
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // switches to the transactions list  once the api responds with data
    expect(await screen.findByTestId('transactions-list')).toBeInTheDocument();

    // headers
    expect(screen.getByText('Transaction')).toBeInTheDocument();
    expect(screen.getByText('Count')).toBeInTheDocument();
    expect(screen.getByText('Time Spent')).toBeInTheDocument();

    // first row
    const transaction1 = screen.getByText('transaction-1');
    expect(transaction1).toBeInTheDocument();
    expect(transaction1).toHaveAttribute(
      'href',
      '/organizations/org-slug/profiling/profile/proj-slug/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/flamegraph/?frameName=bar&framePackage=foo'
    );
    expect(screen.getByText('1k')).toBeInTheDocument();
    expect(screen.getByText('1.00ms')).toBeInTheDocument();

    // second row
    const transaction2 = screen.getByText('transaction-2');
    expect(transaction2).toBeInTheDocument();
    expect(transaction2).toHaveAttribute(
      'href',
      '/organizations/org-slug/profiling/profile/proj-slug/cccccccccccccccccccccccccccccccc/flamegraph/?frameName=bar&framePackage=foo'
    );
    expect(screen.getByText('2.5k')).toBeInTheDocument();
    expect(screen.getByText('0.50ms')).toBeInTheDocument();

    // toggle the second function
    const toggles = screen.getAllByRole('button', {});
    expect(toggles.length).toEqual(2);
    await userEvent.click(toggles[1]);

    // first row
    const transaction3 = await screen.findByText('transaction-3');
    expect(transaction3).toBeInTheDocument();
    expect(transaction3).toHaveAttribute(
      'href',
      '/organizations/org-slug/profiling/profile/proj-slug/dddddddddddddddddddddddddddddddd/flamegraph/?frameName=qux&framePackage=baz'
    );
    expect(screen.getByText('2k')).toBeInTheDocument();
    expect(screen.getByText('2.00ms')).toBeInTheDocument();

    // second row
    const transaction4 = screen.getByText('transaction-4');
    expect(transaction4).toBeInTheDocument();
    expect(transaction4).toHaveAttribute(
      'href',
      '/organizations/org-slug/profiling/profile/proj-slug/ffffffffffffffffffffffffffffffff/flamegraph/?frameName=qux&framePackage=baz'
    );
    expect(screen.getByText('3.5k')).toBeInTheDocument();
    expect(screen.getByText('0.70ms')).toBeInTheDocument();
  });
});

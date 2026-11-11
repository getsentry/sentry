import type {OnUrlUpdateFunction} from 'nuqs/adapters/testing';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import {SlowestFunctionsWidget} from './slowestFunctionsWidget';

describe('SlowestFunctionsWidget', () => {
  beforeEach(() => {
    const project = ProjectFixture({
      id: '1',
      slug: 'proj-slug',
    });

    ProjectsStore.loadInitialData([project]);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders errors', async () => {
    // return 400 for all queries
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      statusCode: 400,
    });

    render(<SlowestFunctionsWidget widgetHeight="100px" breakdownFunction="p75()" />);

    // starts by rendering loading
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // switches to errors once the api responds with an error
    expect(await screen.findByTestId('error-indicator')).toBeInTheDocument();
  });

  it('renders no functions', async () => {
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

    render(<SlowestFunctionsWidget widgetHeight="100px" breakdownFunction="p75()" />);

    // starts by rendering loading
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // switches to the no functions view
    expect(await screen.findByText('No functions found')).toBeInTheDocument();
  });

  it('pushes the cursor when paginating', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
      headers: {
        Link: '<http://127.0.0.1:8000/api/0/organizations/org-slug/events/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", <http://127.0.0.1:8000/api/0/organizations/org-slug/events/?cursor=0:5:0>; rel="next"; results="true"; cursor="0:5:0"',
      },
    });
    const onNuqsUrlUpdate = jest.fn<
      ReturnType<OnUrlUpdateFunction>,
      Parameters<OnUrlUpdateFunction>
    >();

    const {router} = render(
      <SlowestFunctionsWidget widgetHeight="100px" breakdownFunction="p75()" />,
      {
        onNuqsUrlUpdate,
        initialRouterConfig: {location: {pathname: '/profiling/', query: {tab: 'x'}}},
      }
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Next'}));

    await waitFor(() =>
      expect(router.location.query).toEqual({tab: 'x', slowFnCursor: '0:5:0'})
    );
    expect(onNuqsUrlUpdate).toHaveBeenCalledWith(
      expect.objectContaining({options: expect.objectContaining({history: 'push'})})
    );
  });

  it('removes the cursor without a history entry when the sort changes', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });
    const onNuqsUrlUpdate = jest.fn<
      ReturnType<OnUrlUpdateFunction>,
      Parameters<OnUrlUpdateFunction>
    >();

    const {router} = render(
      <SlowestFunctionsWidget widgetHeight="100px" breakdownFunction="p75()" />,
      {
        onNuqsUrlUpdate,
        initialRouterConfig: {
          location: {pathname: '/profiling/', query: {tab: 'x', slowFnCursor: '0:5:0'}},
        },
      }
    );

    await userEvent.click(
      await screen.findByRole('button', {name: 'total self time spent'})
    );
    await userEvent.click(screen.getByRole('option', {name: 'average self time spent'}));

    await waitFor(() => expect(router.location.query).toEqual({tab: 'x'}));
    expect(onNuqsUrlUpdate).toHaveBeenCalledWith(
      expect.objectContaining({options: expect.objectContaining({history: 'replace'})})
    );
  });

  it.isKnownFlake('renders examples and chart', async () => {
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

    // for the chart + examples
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        123: {
          'all_examples()': {
            order: 0,
            start: 0,
            end: 1000,
            meta: {
              fields: {
                time: 'date',
                fingerprint: 'integer',
                p75: 'duration',
                all_examples: 'string',
              },
              units: {
                time: null,
                fingerprint: null,
                p75: 'nanosecond',
                all_examples: null,
              },
            },
            data: [
              [0, [{count: 0}]],
              [500, [{count: [{profile_id: '1'.repeat(32)}]}]],
              [
                1000,
                [
                  {
                    count: [
                      {profiler_id: '2'.repeat(32), thread_id: '0', start: 0, end: 1000},
                    ],
                  },
                ],
              ],
            ],
          },
          'p75()': {
            order: 1,
            start: 0,
            end: 1000,
            meta: {
              fields: {
                time: 'date',
                fingerprint: 'integer',
                p75: 'duration',
                all_examples: 'string',
              },
              units: {
                time: null,
                fingerprint: null,
                p75: 'nanosecond',
                all_examples: null,
              },
            },
            data: [
              [0, [{count: 1}]],
              [500, [{count: 2}]],
              [1000, [{count: 3}]],
            ],
          },
        },
        456: {
          'all_examples()': {
            order: 0,
            start: 0,
            end: 1000,
            meta: {
              fields: {
                time: 'date',
                fingerprint: 'integer',
                p75: 'duration',
                all_examples: 'string',
              },
              units: {
                time: null,
                fingerprint: null,
                p75: 'nanosecond',
                all_examples: null,
              },
            },
            data: [
              [0, [{count: 0}]],
              [500, [{count: [{profile_id: '3'.repeat(32)}]}]],
              [
                1000,
                [
                  {
                    count: [
                      {profiler_id: '4'.repeat(32), thread_id: '0', start: 0, end: 1000},
                    ],
                  },
                ],
              ],
            ],
          },
          'p75()': {
            order: 1,
            start: 0,
            end: 1000,
            meta: {
              fields: {
                time: 'date',
                fingerprint: 'integer',
                p75: 'duration',
                all_examples: 'string',
              },
              units: {
                time: null,
                fingerprint: null,
                p75: 'nanosecond',
                all_examples: null,
              },
            },
            data: [
              [0, [{count: 1}]],
              [500, [{count: 2}]],
              [1000, [{count: 3}]],
            ],
          },
        },
      },
      match: [
        MockApiClient.matchQuery({
          dataset: 'profileFunctions',
          field: ['fingerprint', 'all_examples()', 'p75()'],
          yAxis: ['all_examples()', 'p75()'],
          project: [1],
        }),
      ],
    });

    render(<SlowestFunctionsWidget widgetHeight="100px" breakdownFunction="p75()" />);

    // switches to the functions-chart  once the api responds with data
    expect(await screen.findByTestId('function-chart')).toBeInTheDocument();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);

    const button = within(items[0]!).getByRole('button', {name: 'Example Profiles'});
    expect(button).toBeInTheDocument();
    // Open example profiles dropdown
    await userEvent.click(button);

    // Check items in example profiles dropdown
    expect(screen.getByText('1'.repeat(8))).toBeInTheDocument();
    expect(screen.getByText('2'.repeat(8))).toBeInTheDocument();
  });
});

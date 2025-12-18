import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {MultiQueryModeContent} from 'sentry/views/explore/multiQueryMode/content';
import {useReadQueriesFromLocation} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {TraceItemDataset} from 'sentry/views/explore/types';

jest.mock('sentry/components/lazyRender', () => ({
  LazyRender: ({children}: {children: React.ReactNode}) => children,
}));

describe('MultiQueryModeContent', () => {
  const {organization, project} = initializeOrg();
  let eventsRequest: any;
  let eventsTimeSeriesRequest: any;

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [project].map(p => parseInt(p.id, 10)),
      environments: [],
      datetime: {
        period: '7d',
        start: null,
        end: null,
        utc: null,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/setup-check/`,
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
      }),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [{key: 'span.op', name: 'span.op'}],
      match: [MockApiClient.matchQuery({attributeType: 'string'})],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [{key: 'span.duration', name: 'span.duration'}],
      match: [MockApiClient.matchQuery({attributeType: 'number'})],
    });

    eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [
          {
            id: '1',
            'span.duration': 100,
            'transaction.span_id': 'abc123',
            trace: 'trace123',
            project: '2',
            timestamp: '2023-01-01T00:00:00.000Z',
          },
        ],
      },
    });
    eventsTimeSeriesRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {
        timeSeries: [TimeSeriesFixture()],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: [],
    });
  });

  it('disables changing fields for count', async () => {
    function Component() {
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    const section = await screen.findByTestId('section-visualize-0');
    expect(within(section).getByRole('button', {name: 'spans'})).toBeDisabled();
  });

  it('changes to count(span.duration) when using count', async () => {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    const section = await screen.findByTestId('section-visualize-0');

    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));

    expect(queries).toEqual([
      {
        yAxes: ['avg(span.self_time)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.self_time', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    await userEvent.click(within(section).getByRole('button', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('option', {name: 'count'}));

    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('disables changing fields for epm', async () => {
    function Component() {
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    const section = await screen.findByTestId('section-visualize-0');
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'epm'}));
    expect(within(section).getByRole('button', {name: 'spans'})).toBeDisabled();
  });

  it('changes to epm() when using epm', async () => {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    const section = await screen.findByTestId('section-visualize-0');

    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));

    expect(queries).toEqual([
      {
        yAxes: ['avg(span.self_time)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.self_time', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    await userEvent.click(within(section).getByRole('button', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('option', {name: 'epm'}));

    expect(queries).toEqual([
      {
        yAxes: ['epm()'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('changes to failure_rate() when using failure_rate', async () => {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    const section = await screen.findByTestId('section-visualize-0');

    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));

    expect(queries).toEqual([
      {
        yAxes: ['avg(span.self_time)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.self_time', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    await userEvent.click(within(section).getByRole('button', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('option', {name: 'failure_rate'}));

    expect(queries).toEqual([
      {
        yAxes: ['failure_rate()'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('disables changing fields for failure_rate', async () => {
    function Component() {
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    const section = await screen.findByTestId('section-visualize-0');
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'failure_rate'}));
    expect(within(section).getByRole('button', {name: 'spans'})).toBeDisabled();
  });

  it('defaults count_unique argument to span.op', async () => {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    const section = await screen.findByTestId('section-visualize-0');

    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'count_unique'}));

    expect(queries).toEqual([
      {
        yAxes: ['count_unique(span.op)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.op', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    await userEvent.click(within(section).getByRole('button', {name: 'count_unique'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));

    expect(queries).toEqual([
      {
        yAxes: ['avg(span.self_time)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.self_time', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    await userEvent.click(within(section).getByRole('button', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('option', {name: 'count_unique'}));

    expect(queries).toEqual([
      {
        yAxes: ['count_unique(span.op)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.op', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('updates visualization and outdated sorts', async () => {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    expect(await screen.findByRole('button', {name: 'Bar'})).toBeInTheDocument();

    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);
    const section = screen.getByTestId('section-visualize-0');
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));

    expect(await screen.findByRole('button', {name: 'Line'})).toBeInTheDocument();
    expect(queries).toEqual([
      {
        yAxes: ['avg(span.self_time)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.self_time', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('explicitly selecting visualization persists it', async () => {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Bar'}));
    await userEvent.click(screen.getByRole('option', {name: 'Area'}));

    const section = screen.getByTestId('section-visualize-0');
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));

    expect(await screen.findByRole('button', {name: 'Area'})).toBeInTheDocument();
    expect(queries).toEqual([
      {
        chartType: 2,
        yAxes: ['avg(span.self_time)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.self_time', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('updates sorts', async () => {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);
    const section = screen.getByTestId('section-sort-by-0');
    await userEvent.click(within(section).getByRole('button', {name: 'timestamp'}));
    await userEvent.click(within(section).getByRole('option', {name: 'id'}));
    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'id',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('updates group bys and outdated sorts', async () => {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);
    const section = screen.getByTestId('section-group-by-0');
    await userEvent.click(within(section).getByRole('button', {name: 'None'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.op'}));
    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'count(span.duration)',
            kind: 'desc',
          },
        ],
        query: '',
        groupBys: ['span.op'],
        fields: ['id', 'span.duration', 'timestamp'],
      },
    ]);
  });

  it('allows changing a query', async () => {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    const section = screen.getByTestId('section-visualize-0');
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));
    expect(queries).toEqual([
      {
        yAxes: ['avg(span.self_time)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.self_time', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('allows changing case insensitivity', async () => {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    await userEvent.click(screen.getByLabelText('Ignore case'));
    expect(queries).toEqual([
      {
        caseInsensitive: '1',
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('allows adding a query', async () => {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    // Add chart
    await userEvent.click(screen.getByRole('button', {name: 'Add Query'}));
    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('allows duplicating a query', async () => {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    const section = screen.getByTestId('section-visualize-0');
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));

    // Duplicate chart
    await userEvent.click(screen.getByRole('button', {name: 'More options'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Duplicate Query'}));
    expect(queries).toEqual([
      {
        yAxes: ['avg(span.self_time)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.self_time', 'timestamp'],
        groupBys: [],
        query: '',
      },
      {
        yAxes: ['avg(span.self_time)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.self_time', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('allows deleting a query', async () => {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    // Add chart
    await userEvent.click(screen.getByRole('button', {name: 'Add Query'}));
    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    const section = screen.getByTestId('section-visualize-0');
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));
    expect(queries).toEqual([
      {
        yAxes: ['avg(span.self_time)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.self_time', 'timestamp'],
        groupBys: [],
        query: '',
      },
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    await userEvent.click(screen.getAllByRole('button', {name: 'More options'})[0]!);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Delete Query'}));

    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('calls events and stats APIs', async () => {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    const section = screen.getByTestId('section-group-by-0');
    await userEvent.click(within(section).getByRole('button', {name: 'None'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.op'}));

    await waitFor(() =>
      expect(eventsTimeSeriesRequest).toHaveBeenNthCalledWith(
        1,
        `/organizations/${organization.slug}/events-timeseries/`,
        expect.objectContaining({
          query: expect.objectContaining({
            caseInsensitive: undefined,
            dataset: 'spans',
            disableAggregateExtrapolation: '0',
            environment: [],
            excludeOther: 0,
            groupBy: [],
            interval: '30m',
            partial: 1,
            project: [2],
            query: '',
            referrer: 'api.explore.spans-timeseries',
            sampling: 'NORMAL',
            sort: '-timestamp',
            statsPeriod: '7d',
            topEvents: undefined,
            yAxis: ['count(span.duration)'],
          }),
        })
      )
    );
    await waitFor(() =>
      expect(eventsRequest).toHaveBeenNthCalledWith(
        1,
        `/organizations/${organization.slug}/events/`,
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spans',
            environment: [],
            field: [
              'id',
              'span.duration',
              'timestamp',
              'transaction.span_id',
              'trace',
              'project',
            ],
            per_page: 10,
            project: ['2'],
            query: '',
            referrer: 'api.explore.multi-query-spans-table',
            sort: '-timestamp',
            statsPeriod: '7d',
          }),
        })
      )
    );

    // group by requests
    await waitFor(() =>
      expect(eventsTimeSeriesRequest).toHaveBeenNthCalledWith(
        2,
        `/organizations/${organization.slug}/events-timeseries/`,
        expect.objectContaining({
          query: expect.objectContaining({
            caseInsensitive: undefined,
            dataset: 'spans',
            disableAggregateExtrapolation: '0',
            environment: [],
            excludeOther: 0,
            groupBy: ['span.op'],
            interval: '30m',
            partial: 1,
            project: [2],
            query: '',
            referrer: 'api.explore.spans-timeseries',
            sampling: 'NORMAL',
            sort: '-count_span_duration',
            statsPeriod: '7d',
            topEvents: 5,
            yAxis: ['count(span.duration)'],
          }),
        })
      )
    );
    await waitFor(() =>
      expect(eventsRequest).toHaveBeenNthCalledWith(
        2,
        `/organizations/${organization.slug}/events/`,
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spans',
            environment: [],
            field: ['span.op', 'count(span.duration)'],
            per_page: 10,
            project: ['2'],
            query: '',
            referrer: 'api.explore.multi-query-spans-table',
            sort: '-count_span_duration',
            statsPeriod: '7d',
          }),
        })
      )
    );
  });

  it('unstacking group by puts you in sample mode', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [
          {
            'span.op': 'POST',
            'avg(span.duration)': 147.02002059925093,
          },
          {
            'span.op': 'GET',
            'avg(span.duration)': 1.9993342331511974,
          },
        ],
      },
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.field.includes('span.op');
        },
      ],
    });

    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Component />
      </TraceItemAttributeProvider>
    );

    expect(queries).toEqual([
      {
        chartType: undefined,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
      },
    ]);

    const section = screen.getByTestId('section-group-by-0');
    await userEvent.click(within(section).getByRole('button', {name: 'None'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.op'}));

    await userEvent.click(screen.getAllByTestId('unstack-link')[0]!);

    expect(queries).toEqual([
      {
        chartType: undefined,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'timestamp',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: 'span.op:POST',
      },
    ]);
  });

  it('sets interval correctly', async () => {
    const router = RouterFixture({
      location: {
        pathname: '/traces/compare',
        query: {
          queries: [
            '{"groupBys":[],"query":"","sortBys":["-timestamp"],"yAxes":["avg(span.duration)"]}',
          ],
        },
      },
    });

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <MultiQueryModeContent />
      </TraceItemAttributeProvider>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    const section = screen.getByTestId('section-visualization-0');
    expect(
      await within(section).findByRole('button', {name: '30 minutes'})
    ).toBeInTheDocument();
    await userEvent.click(within(section).getByRole('button', {name: '30 minutes'}));
    await userEvent.click(within(section).getByRole('option', {name: '3 hours'}));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/traces/compare',
      query: expect.objectContaining({
        interval: '3h',
        queries: [
          '{"groupBys":[],"query":"","sortBys":["-timestamp"],"yAxes":["avg(span.duration)"]}',
        ],
      }),
    });
  });

  it('renders a save query button', async () => {
    render(<MultiQueryModeContent />, {
      organization,
      deprecatedRouterMocks: true,
    });
    expect(await screen.findByLabelText('Save')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Save'));
    expect(await screen.findByText('A New Query')).toBeInTheDocument();
  });

  it('highlights save button when query has changes', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/123/`,
      method: 'GET',
      body: {
        query: [
          {
            query: '',
            fields: ['count(span.duration)'],
            groupby: ['span.op'],
            orderby: '-count(span.duration)',
            visualize: [
              {
                chartType: 1,
                yAxes: ['count(span.duration)'],
              },
            ],
            mode: 'aggregate',
          },
        ],
        range: '14d',
        projects: [],
        environment: [],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/123/visit/`,
      method: 'POST',
    });
    const router = RouterFixture({
      location: {
        pathname: '/traces/compare',
        query: {
          queries: [
            '{"groupBys":[],"query":"","sortBys":["-timestamp"],"yAxes":["avg(span.duration)"]}',
          ],
          id: '123',
        },
      },
    });

    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <MultiQueryModeContent />
      </TraceItemAttributeProvider>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );
    // No good way to check for highlighted css, so we just check for the text
    expect(await screen.findByText('Save')).toBeInTheDocument();
  });
});

import {initializeData as _initializeData} from 'sentry-test/performance/initializePerformanceData';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import TraceView from 'sentry/components/events/interfaces/spans/traceView';
import WaterfallModel from 'sentry/components/events/interfaces/spans/waterfallModel';
import ProjectsStore from 'sentry/stores/projectsStore';
import {EntryType, EventTransaction} from 'sentry/types';
import * as QuickTraceContext from 'sentry/utils/performance/quickTrace/quickTraceContext';
import QuickTraceQuery from 'sentry/utils/performance/quickTrace/quickTraceQuery';

function initializeData(settings) {
  const data = _initializeData(settings);
  act(() => void ProjectsStore.loadInitialData(data.organization.projects));
  return data;
}

function generateSampleEvent(): EventTransaction {
  const event = {
    id: '2b658a829a21496b87fd1f14a61abf65',
    eventID: '2b658a829a21496b87fd1f14a61abf65',
    title: '/organizations/:orgId/discover/results/',
    type: 'transaction',
    startTimestamp: 1622079935.86141,
    endTimestamp: 1622079940.032905,
    contexts: {
      trace: {
        trace_id: '8cbbc19c0f54447ab702f00263262726',
        span_id: 'a000000000000000',
        op: 'pageload',
        status: 'unknown',
        type: 'trace',
      },
    },
    entries: [
      {
        data: [],
        type: EntryType.SPANS,
      },
    ],
  } as EventTransaction;

  return event;
}

function generateSampleSpan(
  description: string | null,
  op: string | null,
  span_id: string,
  parent_span_id: string,
  event: EventTransaction
) {
  const span = {
    start_timestamp: 1000,
    timestamp: 2000,
    description,
    op,
    span_id,
    parent_span_id,
    trace_id: '8cbbc19c0f54447ab702f00263262726',
    status: 'ok',
    tags: {
      'http.status_code': '200',
    },
    data: {},
  };

  event.entries[0].data.push(span);
  return span;
}

describe('TraceView', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should render siblings with the same op and description as a grouped span in the minimap and span tree', async () => {
    const data = initializeData({
      features: ['performance-autogroup-sibling-spans'],
    });

    const event = generateSampleEvent();
    generateSampleSpan('group me', 'http', 'b000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'c000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'd000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'e000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'f000000000000000', 'a000000000000000', event);

    const waterfallModel = new WaterfallModel(event);

    render(
      <TraceView organization={data.organization} waterfallModel={waterfallModel} />
    );

    expect(await screen.findByTestId('minimap-sibling-group-bar')).toBeInTheDocument();
    expect(await screen.findByTestId('span-row-2')).toHaveTextContent('Autogrouped');
    expect(screen.queryByTestId('span-row-3')).not.toBeInTheDocument();
  });

  it('should expand grouped siblings when clicked, and then regroup when clicked again', async () => {
    // eslint-disable-next-line no-console
    console.error = jest.fn();

    const data = initializeData({
      features: ['performance-autogroup-sibling-spans'],
    });

    const event = generateSampleEvent();
    generateSampleSpan('group me', 'http', 'b000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'c000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'd000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'e000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'f000000000000000', 'a000000000000000', event);

    const waterfallModel = new WaterfallModel(event);

    render(
      <TraceView organization={data.organization} waterfallModel={waterfallModel} />
    );

    const groupedSiblingsSpan = await screen.findByText('Autogrouped — http —');
    userEvent.click(groupedSiblingsSpan);

    await waitFor(() =>
      expect(screen.queryByText('Autogrouped — http —')).not.toBeInTheDocument()
    );

    for (let i = 1; i < 7; i++) {
      expect(await screen.findByTestId(`span-row-${i}`)).toBeInTheDocument();
    }

    const regroupButton = await screen.findByText('Regroup');
    expect(regroupButton).toBeInTheDocument();
    userEvent.click(regroupButton);

    await waitFor(() =>
      expect(screen.queryByTestId('span-row-6')).not.toBeInTheDocument()
    );

    expect(await screen.findByText('Autogrouped — http —')).toBeInTheDocument();
  });

  it("should not group sibling spans that don't have the same op or description", async () => {
    const data = initializeData({
      features: ['performance-autogroup-sibling-spans'],
    });

    const event = generateSampleEvent();
    generateSampleSpan('test', 'http', 'b000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'c000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'd000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'e000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'f000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'ff00000000000000', 'a000000000000000', event);
    generateSampleSpan('test', 'http', 'fff0000000000000', 'a000000000000000', event);

    const waterfallModel = new WaterfallModel(event);

    render(
      <TraceView organization={data.organization} waterfallModel={waterfallModel} />
    );

    expect(await screen.findByText('group me')).toBeInTheDocument();
    expect(await screen.findAllByText('test')).toHaveLength(2);
  });

  it('should autogroup similar nested spans', async () => {
    const data = initializeData({});

    const event = generateSampleEvent();
    generateSampleSpan('group me', 'http', 'b000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'c000000000000000', 'b000000000000000', event);
    generateSampleSpan('group me', 'http', 'd000000000000000', 'c000000000000000', event);
    generateSampleSpan('group me', 'http', 'e000000000000000', 'd000000000000000', event);
    generateSampleSpan('group me', 'http', 'f000000000000000', 'e000000000000000', event);

    const waterfallModel = new WaterfallModel(event);

    render(
      <TraceView organization={data.organization} waterfallModel={waterfallModel} />
    );

    const grouped = await screen.findByText('group me');
    expect(grouped).toBeInTheDocument();
  });

  it('should expand/collapse only the sibling group that is clicked, even if multiple groups have the same op and description', async () => {
    const data = initializeData({features: ['performance-autogroup-sibling-spans']});

    const event = generateSampleEvent();
    generateSampleSpan('group me', 'http', 'b000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'c000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'd000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'e000000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'f000000000000000', 'a000000000000000', event);

    generateSampleSpan('not me', 'http', 'aa00000000000000', 'a000000000000000', event);

    generateSampleSpan('group me', 'http', 'bb00000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'cc00000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'dd00000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'ee00000000000000', 'a000000000000000', event);
    generateSampleSpan('group me', 'http', 'ff00000000000000', 'a000000000000000', event);

    const waterfallModel = new WaterfallModel(event);

    render(
      <TraceView organization={data.organization} waterfallModel={waterfallModel} />
    );

    expect(screen.queryAllByText('group me')).toHaveLength(2);

    const firstGroup = screen.queryAllByText('Autogrouped — http —')[0];
    userEvent.click(firstGroup);
    expect(await screen.findAllByText('group me')).toHaveLength(6);

    const secondGroup = await screen.findByText('Autogrouped — http —');
    userEvent.click(secondGroup);
    expect(await screen.findAllByText('group me')).toHaveLength(10);

    const firstRegroup = screen.queryAllByText('Regroup')[0];
    userEvent.click(firstRegroup);
    expect(await screen.findAllByText('group me')).toHaveLength(6);

    const secondRegroup = await screen.findByText('Regroup');
    userEvent.click(secondRegroup);
    expect(await screen.findAllByText('group me')).toHaveLength(2);
  });

  it('should allow expanding of embedded transactions', async () => {
    const {organization, project, location} = initializeData({
      features: ['unified-span-view'],
    });

    const event = generateSampleEvent();
    generateSampleSpan(
      'parent span',
      'db',
      'b000000000000000',
      'a000000000000000',
      event
    );
    const waterfallModel = new WaterfallModel(event);

    const eventsTraceMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-trace/${event.contexts.trace?.trace_id}/`,
      method: 'GET',
      statusCode: 200,
      body: [
        event,
        {
          errors: [],
          event_id: '998d7e2c304c45729545e4434e2967cb',
          generation: 1,
          parent_event_id: '2b658a829a21496b87fd1f14a61abf65',
          parent_span_id: 'b000000000000000',
          project_id: project.id,
          project_slug: project.slug,
          span_id: '8596e2795f88471d',
          transaction:
            '/api/0/organizations/{organization_slug}/events/{project_slug}:{event_id}/',
          'transaction.duration': 159,
          'transaction.op': 'http.server',
        },
      ],
    });

    const eventsTraceLightMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-trace-light/${event.contexts.trace?.trace_id}/`,
      method: 'GET',
      statusCode: 200,
      body: [
        event,
        {
          errors: [],
          event_id: '998d7e2c304c45729545e4434e2967cb',
          generation: 1,
          parent_event_id: '2b658a829a21496b87fd1f14a61abf65',
          parent_span_id: 'b000000000000000',
          project_id: project.id,
          project_slug: project.slug,
          span_id: '8596e2795f88471d',
          transaction:
            '/api/0/organizations/{organization_slug}/events/{project_slug}:{event_id}/',
          'transaction.duration': 159,
          'transaction.op': 'http.server',
        },
      ],
    });

    const embeddedEvent = {
      ...generateSampleEvent(),
      id: '998d7e2c304c45729545e4434e2967cb',
      eventID: '998d7e2c304c45729545e4434e2967cb',
    };
    embeddedEvent.contexts.trace!.span_id = 'a111111111111111';

    const embeddedSpan = generateSampleSpan(
      'i am embedded :)',
      'test',
      'b111111111111111',
      'b000000000000000',
      embeddedEvent
    );
    embeddedSpan.trace_id = '8cbbc19c0f54447ab702f00263262726';

    const fetchEmbeddedTransactionMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/${project.slug}:998d7e2c304c45729545e4434e2967cb/`,
      method: 'GET',
      statusCode: 200,
      body: embeddedEvent,
    });

    render(
      <QuickTraceQuery event={event} location={location} orgSlug={organization.slug}>
        {results => (
          <QuickTraceContext.Provider value={results}>
            <TraceView organization={organization} waterfallModel={waterfallModel} />
          </QuickTraceContext.Provider>
        )}
      </QuickTraceQuery>
    );

    expect(eventsTraceMock).toHaveBeenCalled();
    expect(eventsTraceLightMock).toHaveBeenCalled();

    const embeddedTransactionBadge = await screen.findByTestId(
      'embedded-transaction-badge'
    );
    expect(embeddedTransactionBadge).toBeInTheDocument();
    userEvent.click(embeddedTransactionBadge);
    expect(fetchEmbeddedTransactionMock).toHaveBeenCalled();
    expect(await screen.findByText(/i am embedded :\)/i)).toBeInTheDocument();
  });

  it('should correctly render sibling autogroup text when op and/or description is not provided', async () => {
    const data = initializeData({
      features: ['performance-autogroup-sibling-spans'],
    });

    const event1 = generateSampleEvent();
    generateSampleSpan('group me', null, 'b000000000000000', 'a000000000000000', event1);
    generateSampleSpan('group me', null, 'c000000000000000', 'a000000000000000', event1);
    generateSampleSpan('group me', null, 'd000000000000000', 'a000000000000000', event1);
    generateSampleSpan('group me', null, 'e000000000000000', 'a000000000000000', event1);
    generateSampleSpan('group me', null, 'f000000000000000', 'a000000000000000', event1);

    const {rerender} = render(
      <TraceView
        organization={data.organization}
        waterfallModel={new WaterfallModel(event1)}
      />
    );
    expect(await screen.findByTestId('span-row-2')).toHaveTextContent(
      /Autogrouped — group me/
    );

    const event2 = generateSampleEvent();
    generateSampleSpan(null, 'http', 'b000000000000000', 'a000000000000000', event2);
    generateSampleSpan(null, 'http', 'c000000000000000', 'a000000000000000', event2);
    generateSampleSpan(null, 'http', 'd000000000000000', 'a000000000000000', event2);
    generateSampleSpan(null, 'http', 'e000000000000000', 'a000000000000000', event2);
    generateSampleSpan(null, 'http', 'f000000000000000', 'a000000000000000', event2);

    rerender(
      <TraceView
        organization={data.organization}
        waterfallModel={new WaterfallModel(event2)}
      />
    );

    expect(await screen.findByTestId('span-row-2')).toHaveTextContent(
      /Autogrouped — http/
    );

    const event3 = generateSampleEvent();
    generateSampleSpan(null, null, 'b000000000000000', 'a000000000000000', event3);
    generateSampleSpan(null, null, 'c000000000000000', 'a000000000000000', event3);
    generateSampleSpan(null, null, 'd000000000000000', 'a000000000000000', event3);
    generateSampleSpan(null, null, 'e000000000000000', 'a000000000000000', event3);
    generateSampleSpan(null, null, 'f000000000000000', 'a000000000000000', event3);

    rerender(
      <TraceView
        organization={data.organization}
        waterfallModel={new WaterfallModel(event3)}
      />
    );

    expect(await screen.findByTestId('span-row-2')).toHaveTextContent(
      /Autogrouped — siblings/
    );
  });
});

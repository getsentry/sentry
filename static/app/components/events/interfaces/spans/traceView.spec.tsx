import {
  generateSampleEvent,
  generateSampleSpan,
  initializeData as _initializeData,
} from 'sentry-test/performance/initializePerformanceData';
import {MockSpan, TransactionEventBuilder} from 'sentry-test/performance/utils';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import * as AnchorLinkManager from 'sentry/components/events/interfaces/spans/spanContext';
import TraceView from 'sentry/components/events/interfaces/spans/traceView';
import {spanTargetHash} from 'sentry/components/events/interfaces/spans/utils';
import WaterfallModel from 'sentry/components/events/interfaces/spans/waterfallModel';
import ProjectsStore from 'sentry/stores/projectsStore';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import QuickTraceQuery from 'sentry/utils/performance/quickTrace/quickTraceQuery';

function initializeData(settings) {
  const data = _initializeData(settings);
  ProjectsStore.loadInitialData(data.projects);
  return data;
}

describe('TraceView', () => {
  let data;

  beforeEach(() => {
    data = initializeData({});
  });
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('Autogrouped spans tests', () => {
    it('should render siblings with the same op and description as a grouped span in the minimap and span tree', async () => {
      const builder = new TransactionEventBuilder();
      builder.addSpan(
        new MockSpan({
          startTimestamp: 0,
          endTimestamp: 100,
          op: 'http',
          description: 'group me',
        }),
        5
      );

      const waterfallModel = new WaterfallModel(builder.getEventFixture());

      render(
        <TraceView organization={data.organization} waterfallModel={waterfallModel} />
      );

      expect(await screen.findByTestId('minimap-sibling-group-bar')).toBeInTheDocument();
      expect(await screen.findByTestId('span-row-2')).toHaveTextContent('Autogrouped');
      expect(screen.queryByTestId('span-row-3')).not.toBeInTheDocument();
    });

    it('should expand grouped siblings when clicked, async and then regroup when clicked again', async () => {
      const builder = new TransactionEventBuilder();

      builder.addSpan(
        new MockSpan({
          startTimestamp: 0,
          endTimestamp: 100,
          op: 'http',
          description: 'group me',
        }),
        5
      );

      const waterfallModel = new WaterfallModel(builder.getEventFixture());

      render(
        <TraceView organization={data.organization} waterfallModel={waterfallModel} />
      );

      const groupedSiblingsSpan = await screen.findByText('Autogrouped — http —');
      await userEvent.click(groupedSiblingsSpan);

      await waitFor(() =>
        expect(screen.queryByText('Autogrouped — http —')).not.toBeInTheDocument()
      );

      for (let i = 1; i < 7; i++) {
        expect(await screen.findByTestId(`span-row-${i}`)).toBeInTheDocument();
      }

      const regroupButton = await screen.findByText('Regroup');
      expect(regroupButton).toBeInTheDocument();
      await userEvent.click(regroupButton);

      await waitFor(() =>
        expect(screen.queryByTestId('span-row-6')).not.toBeInTheDocument()
      );

      expect(await screen.findByText('Autogrouped — http —')).toBeInTheDocument();
    });

    it("should not group sibling spans that don't have the same op or description", async () => {
      const builder = new TransactionEventBuilder();
      builder.addSpan(
        new MockSpan({
          startTimestamp: 10,
          endTimestamp: 100,
          op: 'http',
          description: 'test',
        })
      );

      builder.addSpan(
        new MockSpan({
          startTimestamp: 100,
          endTimestamp: 200,
          op: 'http',
          description: 'group me',
        }),
        5
      );

      builder.addSpan(
        new MockSpan({
          startTimestamp: 200,
          endTimestamp: 300,
          op: 'http',
          description: 'test',
        })
      );

      const waterfallModel = new WaterfallModel(builder.getEventFixture());

      render(
        <TraceView organization={data.organization} waterfallModel={waterfallModel} />
      );

      expect(await screen.findByText('group me')).toBeInTheDocument();
      expect(await screen.findAllByText('test')).toHaveLength(2);
    });

    it('should autogroup similar nested spans', async () => {
      const builder = new TransactionEventBuilder();
      const span = new MockSpan({
        startTimestamp: 50,
        endTimestamp: 100,
        op: 'http',
        description: 'group me',
      }).addDuplicateNestedChildren(5);

      builder.addSpan(span);

      const waterfallModel = new WaterfallModel(builder.getEventFixture());

      render(
        <TraceView organization={data.organization} waterfallModel={waterfallModel} />
      );

      const grouped = await screen.findByText('group me');
      expect(grouped).toBeInTheDocument();
    });

    it('should expand/collapse only the sibling group that is clicked, async even if multiple groups have the same op and description', async () => {
      const builder = new TransactionEventBuilder();

      builder.addSpan(
        new MockSpan({
          startTimestamp: 100,
          endTimestamp: 200,
          op: 'http',
          description: 'group me',
        }),
        5
      );

      builder.addSpan(
        new MockSpan({
          startTimestamp: 200,
          endTimestamp: 300,
          op: 'http',
          description: 'not me',
        })
      );

      builder.addSpan(
        new MockSpan({
          startTimestamp: 300,
          endTimestamp: 400,
          op: 'http',
          description: 'group me',
        }),
        5
      );

      const waterfallModel = new WaterfallModel(builder.getEventFixture());

      render(
        <TraceView organization={data.organization} waterfallModel={waterfallModel} />
      );

      expect(screen.queryAllByText('group me')).toHaveLength(2);

      const firstGroup = screen.queryAllByText('Autogrouped — http —')[0];
      await userEvent.click(firstGroup);
      expect(await screen.findAllByText('group me')).toHaveLength(6);

      const secondGroup = await screen.findByText('Autogrouped — http —');
      await userEvent.click(secondGroup);
      expect(await screen.findAllByText('group me')).toHaveLength(10);

      const firstRegroup = screen.queryAllByText('Regroup')[0];
      await userEvent.click(firstRegroup);
      expect(await screen.findAllByText('group me')).toHaveLength(6);

      const secondRegroup = await screen.findByText('Regroup');
      await userEvent.click(secondRegroup);
      expect(await screen.findAllByText('group me')).toHaveLength(2);
    });

    // TODO: This test can be converted later to use the TransactionEventBuilder instead
    it('should allow expanding of embedded transactions', async () => {
      const {organization, project, location} = initializeData({});

      const event = generateSampleEvent();
      generateSampleSpan(
        'parent span',
        'db',
        'b000000000000000',
        'a000000000000000',
        event
      );
      const waterfallModel = new WaterfallModel(event);

      const mockResponse = {
        method: 'GET',
        statusCode: 200,
        body: {
          transactions: [
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
          orphan_errors: [],
        },
      };

      const eventsTraceMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-trace/${event.contexts.trace?.trace_id}/`,
        ...mockResponse,
      });

      const eventsTraceLightMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-trace-light/${event.contexts.trace?.trace_id}/`,
        ...mockResponse,
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
      await userEvent.click(embeddedTransactionBadge);
      expect(fetchEmbeddedTransactionMock).toHaveBeenCalled();
      expect(await screen.findByText(/i am embedded :\)/i)).toBeInTheDocument();
    });

    it('should allow expanding of multiple embedded transactions with the same parent span', async () => {
      const {organization, project, location} = initializeData({});

      const event = generateSampleEvent();
      generateSampleSpan(
        'GET /api/transitive-edge',
        'http.client',
        'b000000000000000',
        'a000000000000000',
        event
      );
      const waterfallModel = new WaterfallModel(event);

      const mockResponse = {
        method: 'GET',
        statusCode: 200,
        body: {
          transactions: [
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
            {
              errors: [],
              event_id: '59e1fe369528499b87dab7221ce6b8a9',
              generation: 1,
              parent_event_id: '2b658a829a21496b87fd1f14a61abf65',
              parent_span_id: 'b000000000000000',
              project_id: project.id,
              project_slug: project.slug,
              span_id: 'aa5abb302ad5b9e1',
              transaction:
                '/api/0/organizations/{organization_slug}/events/{project_slug}:{event_id}/',
              'transaction.duration': 159,
              'transaction.op': 'middleware.nextjs',
            },
          ],
          orphan_errors: [],
        },
      };

      const eventsTraceMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-trace/${event.contexts.trace?.trace_id}/`,
        ...mockResponse,
      });

      const eventsTraceLightMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-trace-light/${event.contexts.trace?.trace_id}/`,
        ...mockResponse,
      });

      const embeddedEvent1 = {
        ...generateSampleEvent(),
        id: '998d7e2c304c45729545e4434e2967cb',
        eventID: '998d7e2c304c45729545e4434e2967cb',
      };
      embeddedEvent1.contexts.trace!.span_id = 'a111111111111111';

      const embeddedSpan1 = generateSampleSpan(
        'i am embedded :)',
        'test',
        'b111111111111111',
        'b000000000000000',
        embeddedEvent1
      );
      embeddedSpan1.trace_id = '8cbbc19c0f54447ab702f00263262726';

      const embeddedEvent2 = {
        ...generateSampleEvent(),
        id: '59e1fe369528499b87dab7221ce6b8a9',
        eventID: '59e1fe369528499b87dab7221ce6b8a9',
      };
      embeddedEvent2.contexts.trace!.span_id = 'a222222222222222';

      const embeddedSpan2 = generateSampleSpan(
        'i am also embedded :o',
        'middleware.nextjs',
        'c111111111111111',
        'b000000000000000',
        embeddedEvent2
      );
      embeddedSpan2.trace_id = '8cbbc19c0f54447ab702f00263262726';

      const fetchEmbeddedTransactionMock1 = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/${project.slug}:998d7e2c304c45729545e4434e2967cb/`,
        method: 'GET',
        statusCode: 200,
        body: embeddedEvent1,
      });

      const fetchEmbeddedTransactionMock2 = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/${project.slug}:59e1fe369528499b87dab7221ce6b8a9/`,
        method: 'GET',
        statusCode: 200,
        body: embeddedEvent2,
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
      await userEvent.click(embeddedTransactionBadge);
      expect(fetchEmbeddedTransactionMock1).toHaveBeenCalled();
      expect(fetchEmbeddedTransactionMock2).toHaveBeenCalled();
      expect(await screen.findByText(/i am embedded :\)/i)).toBeInTheDocument();
      expect(await screen.findByText(/i am also embedded :o/i)).toBeInTheDocument();
    });

    it('should correctly render sibling autogroup text when op and/or description is not provided', async () => {
      data = initializeData({});
      const builder1 = new TransactionEventBuilder();

      // Autogroup without span ops
      builder1.addSpan(
        new MockSpan({
          startTimestamp: 50,
          endTimestamp: 100,
          description: 'group me',
        }),
        5
      );

      const {rerender} = render(
        <TraceView
          organization={data.organization}
          waterfallModel={new WaterfallModel(builder1.getEventFixture())}
        />
      );
      expect(await screen.findByTestId('span-row-2')).toHaveTextContent(
        /Autogrouped — group me/
      );

      // Autogroup without span descriptions
      const builder2 = new TransactionEventBuilder();
      builder2.addSpan(
        new MockSpan({
          startTimestamp: 100,
          endTimestamp: 200,
          op: 'http',
        }),
        5
      );

      rerender(
        <TraceView
          organization={data.organization}
          waterfallModel={new WaterfallModel(builder2.getEventFixture())}
        />
      );

      expect(await screen.findByTestId('span-row-2')).toHaveTextContent(
        /Autogrouped — http/
      );

      // Autogroup without span ops or descriptions
      const builder3 = new TransactionEventBuilder();
      builder3.addSpan(
        new MockSpan({
          startTimestamp: 200,
          endTimestamp: 300,
        }),
        5
      );

      rerender(
        <TraceView
          organization={data.organization}
          waterfallModel={new WaterfallModel(builder3.getEventFixture())}
        />
      );

      expect(await screen.findByTestId('span-row-2')).toHaveTextContent(
        /Autogrouped — siblings/
      );
    });

    it('should automatically expand a sibling span group and select a span if it is anchored', async () => {
      data = initializeData({});

      const builder = new TransactionEventBuilder();
      builder.addSpan(
        new MockSpan({
          startTimestamp: 100,
          endTimestamp: 200,
          op: 'http',
          description: 'group me',
        }),
        5
      );

      // Manually set the hash here, the AnchorLinkManager is expected to automatically expand the group and scroll to the span with this id
      location.hash = spanTargetHash('0000000000000003');

      const waterfallModel = new WaterfallModel(builder.getEventFixture());

      render(
        <AnchorLinkManager.Provider>
          <TraceView organization={data.organization} waterfallModel={waterfallModel} />
        </AnchorLinkManager.Provider>
      );

      expect(await screen.findByText(/0000000000000003/i)).toBeInTheDocument();
      location.hash = '';
    });

    it('should automatically expand a descendant span group and select a span if it is anchored', async () => {
      data = initializeData({});

      const builder = new TransactionEventBuilder();
      const span = new MockSpan({
        startTimestamp: 50,
        endTimestamp: 100,
        op: 'http',
        description: 'group me',
      }).addDuplicateNestedChildren(5);
      builder.addSpan(span);

      location.hash = spanTargetHash('0000000000000003');

      const waterfallModel = new WaterfallModel(builder.getEventFixture());

      render(
        <AnchorLinkManager.Provider>
          <TraceView organization={data.organization} waterfallModel={waterfallModel} />
        </AnchorLinkManager.Provider>
      );

      expect(await screen.findByText(/0000000000000003/i)).toBeInTheDocument();
      location.hash = '';
    });
  });

  it('should merge web vitals labels if they are too close together', () => {
    data = initializeData({});

    const event = generateSampleEvent();
    generateSampleSpan('browser', 'test1', 'b000000000000000', 'a000000000000000', event);
    generateSampleSpan('browser', 'test2', 'c000000000000000', 'a000000000000000', event);
    generateSampleSpan('browser', 'test3', 'd000000000000000', 'a000000000000000', event);
    generateSampleSpan('browser', 'test4', 'e000000000000000', 'a000000000000000', event);
    generateSampleSpan('browser', 'test5', 'f000000000000000', 'a000000000000000', event);

    event.measurements = {
      fcp: {value: 1000},
      fp: {value: 1050},
      lcp: {value: 1100},
    };

    const waterfallModel = new WaterfallModel(event);

    render(
      <TraceView organization={data.organization} waterfallModel={waterfallModel} />
    );

    const labelContainer = screen.getByText(/fcp/i).parentElement?.parentElement;
    expect(labelContainer).toBeInTheDocument();
    expect(within(labelContainer!).getByText(/fcp/i)).toBeInTheDocument();
    expect(within(labelContainer!).getByText(/fp/i)).toBeInTheDocument();
    expect(within(labelContainer!).getByText(/lcp/i)).toBeInTheDocument();
  });

  it('should not merge web vitals labels if they are spaced away from each other', () => {
    data = initializeData({});

    const event = generateSampleEvent();
    generateSampleSpan('browser', 'test1', 'b000000000000000', 'a000000000000000', event);

    event.startTimestamp = 1;
    event.endTimestamp = 100;

    event.measurements = {
      fcp: {value: 858.3002090454102, unit: 'millisecond'},
      lcp: {value: 1000363.800048828125, unit: 'millisecond'},
    };

    const waterfallModel = new WaterfallModel(event);

    render(
      <TraceView organization={data.organization} waterfallModel={waterfallModel} />
    );

    const fcpLabelContainer = screen.getByText(/fcp/i).parentElement?.parentElement;
    expect(fcpLabelContainer).toBeInTheDocument();
    // LCP should not be merged along with FCP. We expect it to be in a separate element
    expect(within(fcpLabelContainer!).queryByText(/lcp/i)).not.toBeInTheDocument();

    const lcpLabelContainer = screen.getByText(/lcp/i).parentElement?.parentElement;
    expect(lcpLabelContainer).toBeInTheDocument();
  });

  it('should have all focused spans visible', async () => {
    data = initializeData({});

    const event = generateSampleEvent();
    for (let i = 0; i < 10; i++) {
      generateSampleSpan(`desc${i}`, 'db', `id${i}`, 'c000000000000000', event);
    }

    const waterfallModel = new WaterfallModel(event, ['id3'], ['id3', 'id4']);

    render(
      <TraceView organization={data.organization} waterfallModel={waterfallModel} />
    );

    expect(await screen.findByTestId('span-row-1')).toHaveTextContent('desc3');
    expect(await screen.findByTestId('span-row-2')).toHaveTextContent('desc4');
    expect(screen.queryByTestId('span-row-3')).not.toBeInTheDocument();
  });
});

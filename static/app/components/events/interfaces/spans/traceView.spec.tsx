import {
  generateSampleEvent,
  generateSampleSpan,
  initializeData as _initializeData,
} from 'sentry-test/performance/initializePerformanceData';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import * as AnchorLinkManager from 'sentry/components/events/interfaces/spans/anchorLinkManager';
import TraceView from 'sentry/components/events/interfaces/spans/traceView';
import {spanTargetHash} from 'sentry/components/events/interfaces/spans/utils';
import WaterfallModel from 'sentry/components/events/interfaces/spans/waterfallModel';
import ProjectsStore from 'sentry/stores/projectsStore';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import QuickTraceQuery from 'sentry/utils/performance/quickTrace/quickTraceQuery';

function initializeData(settings) {
  const data = _initializeData(settings);
  act(() => void ProjectsStore.loadInitialData(data.organization.projects));
  return data;
}

describe('TraceView', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('Autogrouped spans tests', () => {
    it('should render siblings with the same op and description as a grouped span in the minimap and span tree', async () => {
      const data = initializeData({
        features: ['performance-autogroup-sibling-spans'],
      });

      const event = generateSampleEvent();
      generateSampleSpan(
        'group me',
        'http',
        'b000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'c000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'd000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'e000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'f000000000000000',
        'a000000000000000',
        event
      );

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
      jest.spyOn(console, 'error').mockImplementation(jest.fn());

      const data = initializeData({
        features: ['performance-autogroup-sibling-spans'],
      });

      const event = generateSampleEvent();
      generateSampleSpan(
        'group me',
        'http',
        'b000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'c000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'd000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'e000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'f000000000000000',
        'a000000000000000',
        event
      );

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
      generateSampleSpan(
        'group me',
        'http',
        'c000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'd000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'e000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'f000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'ff00000000000000',
        'a000000000000000',
        event
      );
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
      generateSampleSpan(
        'group me',
        'http',
        'b000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'c000000000000000',
        'b000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'd000000000000000',
        'c000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'e000000000000000',
        'd000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'f000000000000000',
        'e000000000000000',
        event
      );

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
      generateSampleSpan(
        'group me',
        'http',
        'b000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'c000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'd000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'e000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'f000000000000000',
        'a000000000000000',
        event
      );

      generateSampleSpan('not me', 'http', 'aa00000000000000', 'a000000000000000', event);

      generateSampleSpan(
        'group me',
        'http',
        'bb00000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'cc00000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'dd00000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'ee00000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'ff00000000000000',
        'a000000000000000',
        event
      );

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
      generateSampleSpan(
        'group me',
        null,
        'b000000000000000',
        'a000000000000000',
        event1
      );
      generateSampleSpan(
        'group me',
        null,
        'c000000000000000',
        'a000000000000000',
        event1
      );
      generateSampleSpan(
        'group me',
        null,
        'd000000000000000',
        'a000000000000000',
        event1
      );
      generateSampleSpan(
        'group me',
        null,
        'e000000000000000',
        'a000000000000000',
        event1
      );
      generateSampleSpan(
        'group me',
        null,
        'f000000000000000',
        'a000000000000000',
        event1
      );

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

    it('should automatically expand a sibling span group and select a span if it is anchored', async () => {
      const data = initializeData({
        features: ['performance-autogroup-sibling-spans'],
      });

      const event = generateSampleEvent();
      generateSampleSpan(
        'group me',
        'http',
        'b000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'c000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'd000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'e000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'f000000000000000',
        'a000000000000000',
        event
      );

      // Manually set the hash here, the AnchorLinkManager is expected to automatically expand the group and scroll to the span with this id
      location.hash = spanTargetHash('c000000000000000');

      const waterfallModel = new WaterfallModel(event);

      render(
        <AnchorLinkManager.Provider>
          <TraceView organization={data.organization} waterfallModel={waterfallModel} />
        </AnchorLinkManager.Provider>
      );

      expect(await screen.findByText(/c000000000000000/i)).toBeInTheDocument();
      location.hash = '';
    });

    it('should automatically expand a descendant span group and select a span if it is anchored', async () => {
      const data = initializeData({});

      const event = generateSampleEvent();
      generateSampleSpan(
        'group me',
        'http',
        'b000000000000000',
        'a000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'c000000000000000',
        'b000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'd000000000000000',
        'c000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'e000000000000000',
        'd000000000000000',
        event
      );
      generateSampleSpan(
        'group me',
        'http',
        'f000000000000000',
        'e000000000000000',
        event
      );

      location.hash = spanTargetHash('d000000000000000');

      const waterfallModel = new WaterfallModel(event);

      render(
        <AnchorLinkManager.Provider>
          <TraceView organization={data.organization} waterfallModel={waterfallModel} />
        </AnchorLinkManager.Provider>
      );

      expect(await screen.findByText(/d000000000000000/i)).toBeInTheDocument();
      location.hash = '';
    });
  });

  it('should merge web vitals labels if they are too close together', () => {
    const data = initializeData({});

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
    const data = initializeData({});

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
});

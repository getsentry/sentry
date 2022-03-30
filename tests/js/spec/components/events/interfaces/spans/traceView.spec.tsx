import {initializeData as _initializeData} from 'sentry-test/performance/initializePerformanceData';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import TraceView from 'sentry/components/events/interfaces/spans/traceView';
import WaterfallModel from 'sentry/components/events/interfaces/spans/waterfallModel';
import ProjectsStore from 'sentry/stores/projectsStore';
import {EntryType, EventTransaction} from 'sentry/types';

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
  description: string,
  op: string,
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
    data: {
      method: 'GET',
      type: 'fetch',
      url: '/api/0/organizations/?member=1',
    },
  };

  event.entries[0].data.push(span);
  return span;
}

describe('TraceView', () => {
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
});

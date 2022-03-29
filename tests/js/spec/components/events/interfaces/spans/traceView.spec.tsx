import {initializeData as _initializeData} from 'sentry-test/performance/initializePerformanceData';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import TraceView from 'sentry/components/events/interfaces/spans/traceView';
import WaterfallModel from 'sentry/components/events/interfaces/spans/waterfallModel';
import ProjectsStore from 'sentry/stores/projectsStore';
import {EntryType, EventTransaction} from 'sentry/types';

function initializeData(settings) {
  const data = _initializeData(settings);
  ProjectsStore.loadInitialData(data.organization.projects);
  // act(() => void ProjectsStore.loadInitialData(data.organization.projects));
  return data;
}

describe('TraceView', () => {
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
        data: [
          {
            start_timestamp: 1000,
            timestamp: 2000,
            description: 'group me',
            op: 'http',
            span_id: 'b000000000000000',
            parent_span_id: 'a000000000000000',
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
          },
          {
            start_timestamp: 1000,
            timestamp: 2000,
            description: 'group me',
            op: 'http',
            span_id: 'c000000000000000',
            parent_span_id: 'a000000000000000',
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
          },
          {
            start_timestamp: 1000,
            timestamp: 2000,
            description: 'group me',
            op: 'http',
            span_id: 'd000000000000000',
            parent_span_id: 'a000000000000000',
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
          },
          {
            start_timestamp: 1000,
            timestamp: 2000,
            description: 'group me',
            op: 'http',
            span_id: 'e000000000000000',
            parent_span_id: 'a000000000000000',
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
          },
          {
            start_timestamp: 1000,
            timestamp: 2000,
            description: 'group me',
            op: 'http',
            span_id: 'f000000000000000',
            parent_span_id: 'a000000000000000',
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
          },
        ],
        type: EntryType.SPANS,
      },
    ],
  } as EventTransaction;

  it('should render siblings with the same op and description as a grouped span in the minimap ', async () => {
    const data = initializeData({
      features: ['performance-autogroup-sibling-spans'],
    });
    const waterfallModel = new WaterfallModel(event);

    render(
      <TraceView organization={data.organization} waterfallModel={waterfallModel} />
    );

    expect(await screen.findByTestId('minimap-sibling-group-bar')).toBeInTheDocument();
  });

  it('should expand grouped siblings when clicked', async () => {
    console.error = jest.fn();

    const data = initializeData({
      features: ['performance-autogroup-sibling-spans'],
    });
    const waterfallModel = new WaterfallModel(event);

    render(
      <TraceView organization={data.organization} waterfallModel={waterfallModel} />
    );

    const groupedSiblingsSpan = await screen.findByText('group me');
    userEvent.click(groupedSiblingsSpan);

    // Start at 2, since the root span will be span-row-1
    for (let i = 2; i < 7; i++) {
      expect(await screen.findByTestId(`span-row-${i}`)).toBeInTheDocument();
    }
  });
});

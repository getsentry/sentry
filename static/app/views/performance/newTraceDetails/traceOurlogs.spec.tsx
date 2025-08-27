import {useRef} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {
  TraceViewLogsDataProvider,
  TraceViewLogsSection,
} from 'sentry/views/performance/newTraceDetails/traceOurlogs';

const TRACE_SLUG = '00000000000000000000000000000000';

function Component({traceSlug}: {traceSlug: string}) {
  const ref = useRef(null);
  return (
    <TraceViewLogsDataProvider traceSlug={traceSlug}>
      <TraceViewLogsSection scrollContainer={ref} />
    </TraceViewLogsDataProvider>
  );
}

describe('TraceViewLogsSection', () => {
  beforeEach(() => {
    // the search query combobox is firing updates and causing console.errors
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('renders empty logs', async () => {
    const organization = OrganizationFixture({features: ['ourlogs-enabled']});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-logs/`,
      body: {
        data: [],
        meta: {},
      },
    });
    render(<Component traceSlug={TRACE_SLUG} />, {organization});

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    expect(mockRequest).toHaveBeenCalledTimes(1);

    // without waiting a few ticks, the test fails just before the
    // promise corresponding to the request resolves
    // by adding some ticks, it forces the test to wait a little longer
    // until the promise is resolved
    for (let i = 0; i < 10; i++) {
      await tick();
    }

    expect(screen.getByText(/No logs found/)).toBeInTheDocument();
  });

  it('renders some logs', async () => {
    const now = new Date();
    const organization = OrganizationFixture({features: ['ourlogs-enabled']});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-logs/`,
      body: {
        data: [
          {
            'sentry.item_id': '11111111111111111111111111111111',
            'project.id': 1,
            trace: TRACE_SLUG,
            severity_number: 0,
            severity: 'info',
            timestamp: now.toISOString(),
            [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: now.getTime() * 1e6,
            message: 'i am a log',
          },
        ],
        meta: {},
      },
    });
    render(<Component traceSlug={TRACE_SLUG} />, {organization});

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    expect(mockRequest).toHaveBeenCalledTimes(1);

    // without waiting a few ticks, the test fails just before the
    // promise corresponding to the request resolves
    // by adding some ticks, it forces the test to wait a little longer
    // until the promise is resolved
    for (let i = 0; i < 10; i++) {
      await tick();
    }

    expect(screen.getByText(/i am a log/)).toBeInTheDocument();
  });
});

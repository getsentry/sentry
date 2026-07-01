import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {mockGetBoundingClientRect} from 'sentry/utils/fixtures/virtualization';
import {LOGS_QUERY_KEY} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {
  TraceViewLogsDataProvider,
  TraceViewLogsSection,
} from 'sentry/views/performance/newTraceDetails/traceOurlogs';

const TRACE_SLUG = '00000000000000000000000000000000';

function Component({traceSlug}: {traceSlug: string}) {
  return (
    <TraceViewLogsDataProvider traceSlug={traceSlug}>
      <TraceViewLogsSection />
    </TraceViewLogsDataProvider>
  );
}

beforeEach(mockGetBoundingClientRect);

describe('TraceViewLogsSection', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      method: 'GET',
      body: [],
    });
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

    expect(await screen.findByText(/No logs found/)).toBeInTheDocument();
    expect(mockRequest).toHaveBeenCalledTimes(1);
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

    expect(await screen.findByText(/i am a log/)).toBeInTheDocument();
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('shows filter key suggestions when the search is focused', async () => {
    const organization = OrganizationFixture({features: ['ourlogs-enabled']});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-logs/`,
      body: {
        data: [],
        meta: {},
      },
    });
    render(<Component traceSlug={TRACE_SLUG} />, {organization});

    await userEvent.click(
      await screen.findByRole('combobox', {name: 'Add a search term'})
    );

    expect(await screen.findByRole('option', {name: 'severity'})).toBeInTheDocument();
  });

  it('reflects an added filter in the URL', async () => {
    const organization = OrganizationFixture({features: ['ourlogs-enabled']});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-logs/`,
      body: {
        data: [],
        meta: {},
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'POST',
      body: [],
    });
    const {router} = render(<Component traceSlug={TRACE_SLUG} />, {organization});

    const search = await screen.findByRole('combobox', {name: 'Add a search term'});
    await userEvent.type(search, 'hello{enter}');

    await waitFor(() => {
      expect(router.location.query[LOGS_QUERY_KEY]).toContain('hello');
    });
  });

  it('shows the similar spans log row action', async () => {
    const now = new Date();
    const organization = OrganizationFixture({features: ['ourlogs-enabled']});
    MockApiClient.addMockResponse({
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

    const row = await screen.findByTestId('log-table-row');
    await userEvent.hover(row);
    const messageCell = await screen.findByTestId('log-table-cell-message');
    await userEvent.click(within(messageCell).getByRole('button', {name: 'Actions'}));

    expect(await screen.findByText('Explore similar spans')).toBeInTheDocument();
  });
});

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {InvoiceComparison} from 'admin/views/invoiceComparison';

const US_URL = 'https://us.example.com/api/0/';
const COMPARISON_URL = '/_admin/cells/us/invoice-comparison/';

function comparisonBody({rowsPage = 1, rowsTotalPages = 1} = {}) {
  return {
    rows: [
      {
        delta_cents: 100,
        delta_pct: 0.1,
        legacy_amount: 1000,
        legacy_invoice_count: 1,
        legacy_invoice_guid: null,
        organization_id: 1,
        organization_slug: 'org-slug',
        platform_amount: 1100,
        platform_invoice_count: 1,
        platform_invoice_guid: null,
        status: 'mismatch',
      },
    ],
    unmatched: [],
    summary: {
      start: '2026-01-01T00:00:00+00:00',
      end: '2026-01-02T00:00:00+00:00',
      legacy_count: 1,
      platform_count: 1,
      over_threshold_count: 1,
      over_threshold_pct: 1,
      queried_at: '2026-01-02T00:00:00+00:00',
      row_count: 1,
      rows_page: rowsPage,
      rows_page_size: 25,
      rows_total_pages: rowsTotalPages,
      unmatched_org_count: 0,
      unmatched_page: 1,
      unmatched_page_size: 25,
      unmatched_total_pages: 1,
    },
  };
}

function renderComparison(query: Record<string, string>) {
  return render(<InvoiceComparison />, {
    initialRouterConfig: {
      location: {pathname: '/_admin/billing-platform/', query},
      route: '/_admin/billing-platform/',
    },
  });
}

describe('InvoiceComparison', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ConfigStore.set('cells', [{name: 'us', locality_url: US_URL}]);
  });

  describe('default window', () => {
    // hoursAgoLocal uses local setHours, so a 24h lookback that crosses a DST
    // transition is 23 or 25 hours. Freeze a non-transition instant.
    beforeEach(() => {
      jest
        .useFakeTimers({
          doNotFake: [
            'setTimeout',
            'clearTimeout',
            'setInterval',
            'clearInterval',
            'nextTick',
            'setImmediate',
            'clearImmediate',
            'queueMicrotask',
          ],
        })
        .setSystemTime(new Date('2026-01-15T15:04:05.000Z'));
    });

    afterEach(() => {
      try {
        jest.runOnlyPendingTimers();
      } finally {
        jest.useRealTimers();
      }
    });

    it('loads the last 24h when the URL has no window', async () => {
      const mock = MockApiClient.addMockResponse({
        url: COMPARISON_URL,
        body: comparisonBody(),
      });

      renderComparison({page_size: '25', rows_page: '1', unmatched_page: '1'});

      expect(await screen.findByRole('link', {name: 'org-slug'})).toBeInTheDocument();
      const {start, end} = mock.mock.calls[0][1].query;
      const windowMs = new Date(end).getTime() - new Date(start).getTime();
      expect(windowMs).toBe(24 * 60 * 60 * 1000);
    });
  });

  it('uses the window from the URL', async () => {
    const start = '2026-01-01T00:00:00.000Z';
    const end = '2026-01-02T00:00:00.000Z';
    const mock = MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody(),
    });

    renderComparison({start, end});

    expect(await screen.findByRole('link', {name: 'org-slug'})).toBeInTheDocument();
    expect(mock).toHaveBeenCalledWith(
      COMPARISON_URL,
      expect.objectContaining({
        host: US_URL,
        query: expect.objectContaining({start, end}),
      })
    );
  });

  it('pins the default window into the URL when paginating', async () => {
    MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody({rowsTotalPages: 2}),
    });
    MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody({rowsPage: 2, rowsTotalPages: 2}),
      match: [MockApiClient.matchQuery({rows_page: 2})],
    });

    const {router} = renderComparison({});
    await userEvent.click(await screen.findByRole('button', {name: 'Next'}));

    expect(router.location.query.rows_page).toBe('2');
    expect(router.location.query.start).toEqual(expect.any(String));
    expect(router.location.query.end).toEqual(expect.any(String));
  });

  it('does not query when the URL has only one bound', async () => {
    const end = '2020-01-01T00:00:00.000Z';
    const mock = MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      statusCode: 400,
      body: {detail: 'end must be >= start.'},
    });

    renderComparison({end});
    await act(async () => {});

    expect(mock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Failed to load comparison/)).not.toBeInTheDocument();
    expect(screen.queryByText('Comparing…')).not.toBeInTheDocument();
    expect(
      new Date(screen.getByLabelText('Generated until (local)').value).toISOString()
    ).toBe(end);
  });

  it('does not query a partial start through now', async () => {
    const start = '2020-01-01T00:00:00.000Z';
    const mock = MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody(),
    });

    renderComparison({start});
    await act(async () => {});

    expect(mock).not.toHaveBeenCalled();
    expect(
      new Date(screen.getByLabelText('Generated since (local)').value).toISOString()
    ).toBe(start);
  });

  it('keeps uncommitted dates when pagination records the default window', async () => {
    const mock = MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody({rowsTotalPages: 2}),
    });
    MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody({rowsPage: 2, rowsTotalPages: 2}),
      match: [MockApiClient.matchQuery({rows_page: 2})],
    });

    const {router} = renderComparison({});
    const start = screen.getByLabelText('Generated since (local)');
    const edited = '2020-06-01T09:30';
    await userEvent.clear(start);
    await userEvent.type(start, edited);
    await userEvent.click(await screen.findByRole('button', {name: 'Next'}));

    expect(start).toHaveValue(edited);
    expect(router.location.query.rows_page).toBe('2');
    expect(router.location.query.start).toBe(mock.mock.calls[0][1].query.start);
    expect(router.location.query.end).toBe(mock.mock.calls[0][1].query.end);
  });

  it('does not replace a one-sided window when changing page size', async () => {
    const end = '2020-01-01T00:00:00.000Z';
    const mock = MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      statusCode: 400,
      body: {detail: 'end must be >= start.'},
    });

    const {router} = renderComparison({end});
    await userEvent.click(screen.getByRole('button', {name: 'Per page 50'}));
    await userEvent.click(screen.getByRole('option', {name: '25'}));

    expect(router.location.query.end).toBe(end);
    expect(router.location.query.start).toBeUndefined();
    expect(router.location.query.page_size).toBe('25');
    expect(mock).not.toHaveBeenCalled();
  });

  it('pins the window when rewriting an unsupported page size', async () => {
    MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody(),
    });

    const {router} = renderComparison({page_size: '200'});

    expect(await screen.findByRole('link', {name: 'org-slug'})).toBeInTheDocument();
    await waitFor(() => {
      expect(router.location.query.page_size).toBe('50');
    });
    expect(router.location.query.start).toEqual(expect.any(String));
    expect(router.location.query.end).toEqual(expect.any(String));
  });

  it('pins the window when clamping an out-of-range page', async () => {
    MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody({rowsPage: 2, rowsTotalPages: 2}),
    });

    const {router} = renderComparison({rows_page: '99'});

    expect(await screen.findByRole('link', {name: 'org-slug'})).toBeInTheDocument();
    await waitFor(() => {
      expect(router.location.query.rows_page).toBe('2');
    });
    expect(router.location.query.start).toEqual(expect.any(String));
    expect(router.location.query.end).toEqual(expect.any(String));
  });
});

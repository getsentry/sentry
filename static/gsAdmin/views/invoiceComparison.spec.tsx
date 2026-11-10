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

  it('does not query when the URL has only an end', async () => {
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
    const input = screen.getByLabelText<HTMLInputElement>('Generated until (local)');
    expect(new Date(input.value).toISOString()).toBe(end);
  });

  it('does not query when the URL has only a start', async () => {
    const mock = MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody(),
    });

    const start = '2020-01-01T00:00:00.000Z';
    renderComparison({start});
    await act(async () => {});

    expect(mock).not.toHaveBeenCalled();
    const input = screen.getByLabelText<HTMLInputElement>('Generated since (local)');
    expect(new Date(input.value).toISOString()).toBe(start);
  });

  it('keeps typed dates when paginating pins the default window', async () => {
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
    const startInput = screen.getByLabelText('Generated since (local)');
    await userEvent.clear(startInput);
    await userEvent.type(startInput, '2020-06-01T09:30');
    await userEvent.click(await screen.findByRole('button', {name: 'Next'}));

    expect(startInput).toHaveValue('2020-06-01T09:30');
    expect(router.location.query.rows_page).toBe('2');
    expect(router.location.query.start).toBe(mock.mock.calls[0][1].query.start);
    expect(router.location.query.end).toBe(mock.mock.calls[0][1].query.end);
  });

  it('keeps a one-sided window when changing page size', async () => {
    const end = '2020-01-01T00:00:00.000Z';
    const mock = MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody(),
    });

    const {router} = renderComparison({end});
    await userEvent.click(screen.getByRole('button', {name: 'Per page 50'}));
    await userEvent.click(screen.getByRole('option', {name: '25'}));

    expect(router.location.query.page_size).toBe('25');
    expect(router.location.query.end).toBe(end);
    expect(router.location.query.start).toBeUndefined();
    expect(mock).not.toHaveBeenCalled();
  });

  it('pins the window when rewriting an unsupported page size', async () => {
    MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody(),
    });

    const {router} = renderComparison({page_size: '200'});

    await waitFor(() => expect(router.location.query.page_size).toBe('50'));
    expect(router.location.query.start).toEqual(expect.any(String));
    expect(router.location.query.end).toEqual(expect.any(String));
  });

  it('pins the window when the backend clamps the page', async () => {
    MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody({rowsPage: 2, rowsTotalPages: 2}),
    });

    const {router} = renderComparison({rows_page: '99'});

    await waitFor(() => expect(router.location.query.rows_page).toBe('2'));
    expect(router.location.query.start).toEqual(expect.any(String));
    expect(router.location.query.end).toEqual(expect.any(String));
  });
});

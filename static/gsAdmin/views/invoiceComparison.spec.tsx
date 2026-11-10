import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
});

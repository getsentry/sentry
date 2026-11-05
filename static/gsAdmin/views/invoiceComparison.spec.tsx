import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {InvoiceComparison} from 'admin/views/invoiceComparison';

const START = '2026-01-01T00:00:00.000Z';
const END = '2026-01-02T00:00:00.000Z';

function comparisonBody() {
  return {
    rows: [],
    unmatched: [],
    summary: {
      start: START,
      end: END,
      queried_at: END,
      legacy_count: 0,
      platform_count: 0,
      over_threshold_count: 0,
      over_threshold_pct: 0,
      row_count: 0,
      rows_page: 1,
      rows_page_size: 50,
      rows_total_pages: 1,
      unmatched_org_count: 0,
      unmatched_page: 1,
      unmatched_page_size: 50,
      unmatched_total_pages: 1,
    },
  };
}

describe('InvoiceComparison', () => {
  beforeEach(() => {
    ConfigStore.set('cells', [
      {name: 'us', locality_url: 'https://us.test/api/0/'},
      {name: 'de', locality_url: 'https://de.test/api/0/'},
    ]);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('queries the region named in the URL', async () => {
    const usMock = MockApiClient.addMockResponse({
      url: '/_admin/cells/us/invoice-comparison/',
      body: comparisonBody(),
    });
    const deMock = MockApiClient.addMockResponse({
      url: '/_admin/cells/de/invoice-comparison/',
      body: comparisonBody(),
    });

    render(<InvoiceComparison />, {
      initialRouterConfig: {
        location: {
          pathname: '/_admin/billing-platform/',
          query: {start: START, end: END, region: 'de'},
        },
      },
    });

    await waitFor(() =>
      expect(deMock).toHaveBeenCalledWith(
        '/_admin/cells/de/invoice-comparison/',
        expect.objectContaining({host: 'https://de.test/api/0/'})
      )
    );
    expect(usMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: /Region/})).toHaveTextContent('de');
  });

  it('persists the selected region to the URL', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/invoice-comparison/',
      body: comparisonBody(),
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/invoice-comparison/',
      body: comparisonBody(),
    });

    const {router} = render(<InvoiceComparison />, {
      initialRouterConfig: {
        location: {
          pathname: '/_admin/billing-platform/',
          query: {start: START, end: END},
        },
      },
    });

    await userEvent.click(screen.getByRole('button', {name: /Region/}));
    await userEvent.click(screen.getByRole('option', {name: 'de'}));

    await waitFor(() =>
      expect(router.location.query).toEqual({start: START, end: END, region: 'de'})
    );
  });
});

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {InvoiceComparison} from 'admin/views/invoiceComparison';

const US_URL = 'https://us.example.com/api/0/';
const COMPARISON_URL = '/_admin/cells/us/invoice-comparison/';
const DE_URL = 'https://de.example.com/api/0/';
const DE_COMPARISON_URL = '/_admin/cells/de/invoice-comparison/';

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
    summary: {
      start: '2026-01-01',
      end: '2026-01-01',
      legacy_count: 1,
      platform_count: 1,
      over_threshold_count: 1,
      over_threshold_pct: 1,
      queried_at: '2026-01-02T00:00:00+00:00',
      row_count: 1,
      rows_page: rowsPage,
      rows_page_size: 25,
      rows_total_pages: rowsTotalPages,
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads yesterday in UTC when the URL has no window', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-10T05:25:00.000Z'));
    const mock = MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody(),
    });

    renderComparison({page_size: '25', rows_page: '1'});

    expect(await screen.findByRole('link', {name: 'org-slug'})).toBeInTheDocument();
    expect(mock.mock.calls[0][1].query).toEqual(
      expect.objectContaining({
        start: '2026-11-09',
        end: '2026-11-09',
      })
    );
    expect(screen.getByLabelText('First day (UTC)')).toHaveValue('2026-11-09');
    expect(screen.getByLabelText('Last day (UTC)')).toHaveValue('2026-11-09');
  });

  it('ignores a URL window that is not days', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-10T05:25:00.000Z'));
    const mock = MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody(),
    });

    renderComparison({
      start: '2026-11-05T04:40:01.496458+00:00',
      end: '2026-11-10T04:40:01.496458+00:00',
    });

    expect(await screen.findByRole('link', {name: 'org-slug'})).toBeInTheDocument();
    expect(mock.mock.calls[0][1].query).toEqual(
      expect.objectContaining({
        start: '2026-11-09',
        end: '2026-11-09',
      })
    );
  });

  it('queries whole UTC days for the selected dates', async () => {
    MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody(),
    });

    const {router} = renderComparison({});
    const startInput = screen.getByLabelText('First day (UTC)');
    const endInput = screen.getByLabelText('Last day (UTC)');
    await userEvent.clear(startInput);
    await userEvent.type(startInput, '2026-11-02');
    await userEvent.clear(endInput);
    await userEvent.type(endInput, '2026-11-03');
    await userEvent.click(screen.getByRole('button', {name: 'Run comparison'}));

    expect(router.location.query.start).toBe('2026-11-02');
    expect(router.location.query.end).toBe('2026-11-03');
  });

  it('queries the whole UTC days from the URL', async () => {
    const mock = MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody(),
    });

    renderComparison({start: '2026-01-01', end: '2026-01-03'});

    expect(await screen.findByRole('link', {name: 'org-slug'})).toBeInTheDocument();
    expect(mock).toHaveBeenCalledWith(
      COMPARISON_URL,
      expect.objectContaining({
        host: US_URL,
        query: expect.objectContaining({
          start: '2026-01-01',
          end: '2026-01-03',
        }),
      })
    );
    expect(screen.getByLabelText('First day (UTC)')).toHaveValue('2026-01-01');
    expect(screen.getByLabelText('Last day (UTC)')).toHaveValue('2026-01-03');
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

    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-10T05:25:00.000Z'));
    const {router} = renderComparison({});
    await userEvent.click(await screen.findByRole('button', {name: 'Next'}));

    expect(router.location.query.rows_page).toBe('2');
    expect(router.location.query.start).toBe('2026-11-09');
    expect(router.location.query.end).toBe('2026-11-09');
  });

  it('does not query when the URL has only an end', async () => {
    const end = '2020-01-01';
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
    expect(screen.getByLabelText('Last day (UTC)')).toHaveValue(end);
  });

  it('does not query when the URL has only a start', async () => {
    const mock = MockApiClient.addMockResponse({
      url: COMPARISON_URL,
      body: comparisonBody(),
    });

    const start = '2020-01-01';
    renderComparison({start});
    await act(async () => {});

    expect(mock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('First day (UTC)')).toHaveValue(start);
  });

  it('keeps typed dates when paginating pins the default window', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-10T05:25:00.000Z'));
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
    const startInput = screen.getByLabelText('First day (UTC)');
    await userEvent.clear(startInput);
    await userEvent.type(startInput, '2020-06-01');
    await userEvent.click(await screen.findByRole('button', {name: 'Next'}));

    expect(startInput).toHaveValue('2020-06-01');
    expect(router.location.query.rows_page).toBe('2');
    expect(router.location.query.start).toBe('2026-11-09');
    expect(router.location.query.end).toBe('2026-11-09');
  });

  it('keeps a one-sided window when changing page size', async () => {
    const end = '2020-01-01';
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

  describe('region', () => {
    const start = '2026-01-01';
    const end = '2026-01-01';

    beforeEach(() => {
      ConfigStore.set('cells', [
        {name: 'us', locality_url: US_URL},
        {name: 'de', locality_url: DE_URL},
      ]);
    });

    it('queries the region named in the URL', async () => {
      const usMock = MockApiClient.addMockResponse({
        url: COMPARISON_URL,
        body: comparisonBody(),
      });
      const deMock = MockApiClient.addMockResponse({
        url: DE_COMPARISON_URL,
        body: comparisonBody(),
      });

      renderComparison({start, end, region: 'de'});

      await waitFor(() =>
        expect(deMock).toHaveBeenCalledWith(
          DE_COMPARISON_URL,
          expect.objectContaining({host: DE_URL})
        )
      );
      expect(usMock).not.toHaveBeenCalled();
      expect(screen.getByRole('button', {name: /Region/})).toHaveTextContent('de');
    });

    it('persists the selected region to the URL', async () => {
      MockApiClient.addMockResponse({
        url: COMPARISON_URL,
        body: comparisonBody(),
      });
      MockApiClient.addMockResponse({
        url: DE_COMPARISON_URL,
        body: comparisonBody(),
      });

      const {router} = renderComparison({start, end});

      await userEvent.click(screen.getByRole('button', {name: /Region/}));
      await userEvent.click(screen.getByRole('option', {name: 'de'}));

      await waitFor(() =>
        expect(router.location.query).toEqual({start, end, region: 'de'})
      );
    });
  });
});

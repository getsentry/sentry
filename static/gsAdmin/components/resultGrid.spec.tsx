import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {ResultGrid} from 'admin/components/resultGrid';

const US_URL = 'https://us.example.com/api/0/';
const DE_URL = 'https://de.example.com/api/0/';
const EU_URL = 'https://eu.example.com/api/0/';

function setupCells() {
  ConfigStore.set('cells', [
    {name: 'us', locality_url: US_URL},
    {name: 'de', locality_url: DE_URL},
  ]);
}

function renderGrid(
  query?: string,
  extraQuery: Record<string, string> = {},
  extraProps: Record<string, any> = {}
) {
  return render(
    <ResultGrid
      inPanel
      isCellScoped
      probeAcrossRegions
      hasSearch
      endpoint="/customers/"
      path="/_admin/customers/"
      method="GET"
      columns={[<th key="name">Customer</th>]}
      columnsForRow={(row: any) => [<td key="name">{row.name}</td>]}
      {...extraProps}
    />,
    {
      initialRouterConfig: {
        location: {
          pathname: '/_admin/customers/',
          query: {...(query ? {query} : {}), ...extraQuery},
        },
        route: '/_admin/customers/',
      },
    }
  );
}

describe('ResultGrid region probing', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    setupCells();
  });

  it('points the user to another region when the default region is empty', async () => {
    // Default region (us) has no matches.
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [],
    });
    // The org actually lives in the de region.
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '1', name: 'Acme'}],
    });

    renderGrid('acme');

    expect(await screen.findByRole('button', {name: 'View in de'})).toBeInTheDocument();
  });

  it('switches to the matching region when the hint is clicked', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [],
    });
    const deRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '1', name: 'Acme'}],
    });

    renderGrid('acme');

    await userEvent.click(await screen.findByRole('button', {name: 'View in de'}));

    // The grid re-fetches against the de region and renders the match.
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    await waitFor(() =>
      expect(deRequest).toHaveBeenCalledWith(
        '/_admin/cells/de/customers/',
        expect.objectContaining({host: DE_URL})
      )
    );
  });

  it('does not probe other regions when there is no search query', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [],
    });
    const deRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '1', name: 'Acme'}],
    });

    renderGrid();

    // Wait for the empty result to settle.
    expect(await screen.findByText('No results')).toBeInTheDocument();
    expect(deRequest).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: 'View in de'})).not.toBeInTheDocument();
  });

  it('does not probe other regions on a paginated (non-first) empty page', async () => {
    // The current region has results on earlier pages; this later page is empty.
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [],
    });
    const deRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '1', name: 'Acme'}],
    });

    renderGrid('acme', {cursor: '0:100:0'});

    expect(await screen.findByText('No results')).toBeInTheDocument();
    expect(deRequest).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: 'View in de'})).not.toBeInTheDocument();
  });

  it('probes other regions when only a similar (non-exact) slug is returned', async () => {
    const exactMatchQuery = (row: any, query: string) => row.slug === query;

    // The current region returns a similar org, but not the exact slug.
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme Inc', slug: 'acme-inc'}],
    });
    // The exact org lives in the de region.
    const deRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Acme', slug: 'acme'}],
    });

    renderGrid('acme', {}, {exactMatchQuery});

    expect(await screen.findByRole('button', {name: 'View in de'})).toBeInTheDocument();
    // The hint text is split across a <span>/<strong>, so match on the
    // combined textContent rather than a single text node.
    expect(
      screen.getByText(
        (_content, element) => /No exact match in/.test(element?.textContent ?? ''),
        {selector: 'span'}
      )
    ).toBeInTheDocument();
    // The similar local result is still shown.
    expect(screen.getByText('Acme Inc')).toBeInTheDocument();
    await waitFor(() => expect(deRequest).toHaveBeenCalled());
  });

  it('does not probe when results span multiple pages (exact slug may be on a later page)', async () => {
    const exactMatchQuery = (row: any, query: string) => row.slug === query;

    // The first page has only a similar slug, but a next page exists — the
    // exact slug could live there, so we must not claim "no exact match".
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme Inc', slug: 'acme-inc'}],
      headers: {
        Link:
          '<https://us.example.com/api/0/_admin/cells/us/customers/?cursor=0:0:1>; ' +
          'rel="previous"; results="false"; cursor="0:0:1", ' +
          '<https://us.example.com/api/0/_admin/cells/us/customers/?cursor=0:100:0>; ' +
          'rel="next"; results="true"; cursor="0:100:0"',
      },
    });
    const deRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Acme', slug: 'acme'}],
    });

    renderGrid('acme', {}, {exactMatchQuery});

    expect(await screen.findByText('Acme Inc')).toBeInTheDocument();
    expect(deRequest).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: 'View in de'})).not.toBeInTheDocument();
  });

  it('does not probe when the exact slug is returned in the current region', async () => {
    const exactMatchQuery = (row: any, query: string) => row.slug === query;

    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme', slug: 'acme'}],
    });
    const deRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Acme', slug: 'acme'}],
    });

    renderGrid('acme', {}, {exactMatchQuery});

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(deRequest).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: 'View in de'})).not.toBeInTheDocument();
  });

  it('normalizes the query before exactMatchQuery (uppercase search matches a lowercase slug)', async () => {
    // The predicate compares against the query as-is; ResultGrid is responsible
    // for trimming + lower-casing, so an uppercase search still matches.
    const exactMatchQuery = (row: any, query: string) => row.slug === query;

    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme', slug: 'acme'}],
    });
    const deRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Acme', slug: 'acme'}],
    });

    renderGrid('  ACME  ', {}, {exactMatchQuery});

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(deRequest).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: 'View in de'})).not.toBeInTheDocument();
  });

  it('does not show a hint when another region is also empty', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [],
    });

    renderGrid('acme');

    expect(await screen.findByText('No results')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('Checking other regions…')).not.toBeInTheDocument()
    );
    expect(screen.queryByRole('button', {name: 'View in de'})).not.toBeInTheDocument();
  });
});

describe('ResultGrid probeAllRegions', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    setupCells();
  });

  const allRegionsProps = {probeAcrossRegions: false, probeAllRegions: true};

  it('flags other regions even with no search query and results in the active region', async () => {
    // The active (us) region already has the user's orgs.
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme'}],
    });
    // The user also belongs to an org in the de region.
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Beta'}],
    });

    renderGrid(undefined, {}, allRegionsProps);

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'View in de'})).toBeInTheDocument();
  });

  it('flags other regions when the active region is empty', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Beta'}],
    });

    renderGrid(undefined, {}, allRegionsProps);

    expect(await screen.findByRole('button', {name: 'View in de'})).toBeInTheDocument();
  });

  it('renders the custom hint text', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme'}],
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Beta'}],
    });

    renderGrid(
      undefined,
      {},
      {
        ...allRegionsProps,
        probeAllRegionsHint: 'This user also belongs to orgs in other regions:',
      }
    );

    expect(
      await screen.findByText('This user also belongs to orgs in other regions:')
    ).toBeInTheDocument();
  });

  it('does not flag when no other region has matches', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme'}],
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [],
    });

    renderGrid(undefined, {}, allRegionsProps);

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('Checking other regions…')).not.toBeInTheDocument()
    );
    expect(screen.queryByRole('button', {name: 'View in de'})).not.toBeInTheDocument();
  });
});

describe('ResultGrid allowAllRegions', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    setupCells();
  });

  const allRegionsProps = {
    allowAllRegions: true,
    sortValueForRow: (row: any) => row.members ?? 0,
    defaultSort: 'members',
  };

  it('queries every region in parallel and shows a Region column', async () => {
    const usRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme', members: 5}],
    });
    const deRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Beta', members: 10}],
    });

    renderGrid(undefined, {}, allRegionsProps);

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(await screen.findByText('Beta')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Region'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'us'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'de'})).toBeInTheDocument();
    expect(usRequest).toHaveBeenCalledWith(
      '/_admin/cells/us/customers/',
      expect.objectContaining({host: US_URL})
    );
    expect(deRequest).toHaveBeenCalledWith(
      '/_admin/cells/de/customers/',
      expect.objectContaining({host: DE_URL})
    );
  });

  it('keeps the merged rows sorted by the sort value', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [
        {id: '1', name: 'Acme', members: 5},
        {id: '3', name: 'Corge', members: 20},
      ],
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Beta', members: 10}],
    });

    renderGrid(undefined, {}, allRegionsProps);

    expect(await screen.findByText('Beta')).toBeInTheDocument();
    expect(await screen.findByText('Acme')).toBeInTheDocument();

    const rows = screen.getAllByRole('row').slice(1); // drop the header row
    const names = rows.map(row => row.textContent);
    expect(names[0]).toContain('Corge');
    expect(names[1]).toContain('Beta');
    expect(names[2]).toContain('Acme');
  });

  it('places the Region column at regionColumnIndex', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme', members: 5}],
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [],
    });

    renderGrid(
      undefined,
      {},
      {
        ...allRegionsProps,
        columns: [<th key="name">Customer</th>, <th key="joined">Joined</th>],
        columnsForRow: (row: any) => [
          <td key="name">{row.name}</td>,
          <td key="joined">2024</td>,
        ],
        regionColumnIndex: 1,
      }
    );

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map(h => h.textContent)).toEqual(['Customer', 'Region', 'Joined']);
    const cells = screen.getAllByRole('cell');
    expect(cells.map(c => c.textContent)).toEqual(['Acme', 'us', '2024']);
  });

  it('shows the still-loading regions and a progress bar instead of "No results"', async () => {
    let finishDe!: () => void;
    const deGate = new Promise<void>(resolve => {
      finishDe = resolve;
    });

    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme', members: 5}],
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Beta', members: 10}],
      asyncDelay: deGate,
    });

    renderGrid(undefined, {}, allRegionsProps);

    // The status note lists the outstanding region and the table shows an
    // indeterminate progress bar while any region is still loading.
    expect(await screen.findByText('Still loading')).toBeInTheDocument();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('de');
    expect(screen.getByTestId('table-progress')).toBeInTheDocument();
    expect(screen.queryByText('No results')).not.toBeInTheDocument();

    // Rows that already arrived render below.
    expect(await screen.findByText('Acme')).toBeInTheDocument();

    finishDe();

    expect(await screen.findByText('Beta')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('Still loading')).not.toBeInTheDocument()
    );
    expect(screen.queryByTestId('table-progress')).not.toBeInTheDocument();
  });

  it('shows "No results" only once every region has answered empty', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [],
    });

    renderGrid(undefined, {}, allRegionsProps);

    expect(await screen.findByText('No results')).toBeInTheDocument();
    expect(screen.queryByText('Still loading')).not.toBeInTheDocument();
  });

  it('switches to a single region from the selector', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme', members: 5}],
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Beta', members: 10}],
    });

    renderGrid(undefined, {}, allRegionsProps);

    expect(await screen.findByText('Beta')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /Region/}));
    await userEvent.click(await screen.findByRole('option', {name: 'us'}));

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Beta')).not.toBeInTheDocument());
    expect(screen.queryByRole('columnheader', {name: 'Region'})).not.toBeInTheDocument();
  });

  it('flags a failed region with a warning icon and tooltip', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme', members: 5}],
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      statusCode: 500,
      body: {},
    });

    renderGrid(undefined, {}, allRegionsProps);

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(await screen.findByText('1 region failed')).toBeInTheDocument();

    const icon = screen.getByLabelText('Some regions failed to load');
    await userEvent.hover(icon);
    expect(
      await screen.findByText('Could not load results from: de')
    ).toBeInTheDocument();
  });

  it('shows no cross-region hint while all regions are already queried', async () => {
    // The user-details membership grid combines allowAllRegions with
    // probeAllRegions; the probe hint only applies after narrowing to one region.
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme', members: 5}],
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Beta', members: 10}],
    });

    renderGrid(undefined, {}, {...allRegionsProps, probeAllRegions: true});

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(await screen.findByText('Beta')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'View in de'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'View in us'})).not.toBeInTheDocument();
  });

  it('marks a region as failed when the fetch itself rejects (e.g. blocked request)', async () => {
    // The real API client swallows fetch rejections without calling success
    // or error, so the grid must resolve the region through requestPromise.
    const stubApi = {
      clear: jest.fn(),
      request: jest.fn((url: string, options: any) => {
        if (url.startsWith('/_admin/cells/us/')) {
          options.success([{id: '1', name: 'Acme', members: 5}], 'success', {
            getResponseHeader: () => null,
          });
          return {requestPromise: Promise.resolve()};
        }
        return {requestPromise: Promise.reject(new Error('Failed to fetch'))};
      }),
    };

    renderGrid(undefined, {}, {...allRegionsProps, api: stubApi});

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(await screen.findByText('1 region failed')).toBeInTheDocument();
    await userEvent.hover(screen.getByLabelText('Some regions failed to load'));
    expect(
      await screen.findByText('Could not load results from: de')
    ).toBeInTheDocument();
  });

  it('loads the next page of every region that has one', async () => {
    const usFirstPage = MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      match: [MockApiClient.matchData({cursor: ''})],
      body: [{id: '1', name: 'Acme', members: 5}],
      headers: {
        Link:
          '<https://us.example.com/api/0/_admin/cells/us/customers/?cursor=0:1:0>; ' +
          'rel="next"; results="true"; cursor="0:1:0"',
      },
    });
    const usSecondPage = MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      match: [MockApiClient.matchData({cursor: '0:1:0'})],
      body: [{id: '2', name: 'Beta', members: 4}],
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '3', name: 'Ceta', members: 3}],
    });

    renderGrid(undefined, {}, allRegionsProps);

    // Only the us region has a second page, so only it is named.
    const loadMore = await screen.findByRole('button', {name: 'Load more (us)'});
    expect(usFirstPage).toHaveBeenCalledTimes(1);
    expect(usSecondPage).not.toHaveBeenCalled();

    await userEvent.click(loadMore);

    expect(await screen.findByText('Beta')).toBeInTheDocument();
    // The rows already on screen stay, merged with the new page.
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Ceta')).toBeInTheDocument();
  });

  it('drops the load more control once every region is exhausted', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      match: [MockApiClient.matchData({cursor: ''})],
      body: [{id: '1', name: 'Acme', members: 5}],
      headers: {
        Link:
          '<https://us.example.com/api/0/_admin/cells/us/customers/?cursor=0:1:0>; ' +
          'rel="next"; results="true"; cursor="0:1:0"',
      },
    });
    // The last page reports no further results.
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      match: [MockApiClient.matchData({cursor: '0:1:0'})],
      body: [{id: '2', name: 'Beta', members: 4}],
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [],
    });

    renderGrid(undefined, {}, allRegionsProps);

    await userEvent.click(await screen.findByRole('button', {name: 'Load more (us)'}));

    expect(await screen.findByText('Beta')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', {name: /Load more/})).not.toBeInTheDocument()
    );
  });

  it('keeps the warning of a failed region while another region loads more', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      match: [MockApiClient.matchData({cursor: ''})],
      body: [{id: '1', name: 'Acme', members: 5}],
      headers: {
        Link:
          '<https://us.example.com/api/0/_admin/cells/us/customers/?cursor=0:1:0>; ' +
          'rel="next"; results="true"; cursor="0:1:0"',
      },
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      match: [MockApiClient.matchData({cursor: '0:1:0'})],
      body: [{id: '2', name: 'Beta', members: 4}],
    });
    // The de region never answers, so it holds no cursor and nothing retries
    // it. Its results stay missing from the merged table.
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      statusCode: 500,
      body: {},
    });

    renderGrid(undefined, {}, allRegionsProps);

    expect(await screen.findByText('1 region failed')).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', {name: 'Load more (us)'}));

    expect(await screen.findByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('1 region failed')).toBeInTheDocument();
    expect(screen.getByLabelText('Some regions failed to load')).toBeInTheDocument();
  });

  it('shows no load more control when a single page holds every result', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme', members: 5}],
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Beta', members: 10}],
    });

    renderGrid(undefined, {}, allRegionsProps);

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Load more/})).not.toBeInTheDocument();
  });

  it('errors only when every region fails', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      statusCode: 500,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      statusCode: 500,
      body: {},
    });

    renderGrid(undefined, {}, allRegionsProps);

    expect(await screen.findByText('Something bad happened :/')).toBeInTheDocument();
  });

  it('errors when every region of a load more fails with nothing to show', async () => {
    ConfigStore.set('cells', [
      {name: 'us', locality_url: US_URL},
      {name: 'de', locality_url: DE_URL},
      {name: 'eu', locality_url: EU_URL},
    ]);

    // The us region answers empty but promises a further page, so it is the
    // only region a load more asks again.
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      match: [MockApiClient.matchData({cursor: ''})],
      body: [],
      headers: {
        Link:
          '<https://us.example.com/api/0/_admin/cells/us/customers/?cursor=0:1:0>; ' +
          'rel="next"; results="true"; cursor="0:1:0"',
      },
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      match: [MockApiClient.matchData({cursor: '0:1:0'})],
      statusCode: 500,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      statusCode: 500,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/eu/customers/',
      statusCode: 500,
      body: {},
    });

    renderGrid(undefined, {}, allRegionsProps);

    expect(await screen.findByText('2 regions failed')).toBeInTheDocument();
    expect(screen.queryByText('Something bad happened :/')).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', {name: 'Load more (us)'}));

    expect(await screen.findByText('Something bad happened :/')).toBeInTheDocument();
  });
});

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {ResultGrid} from 'admin/components/resultGrid';

const US_URL = 'https://us.example.com/api/0/';
const DE_URL = 'https://de.example.com/api/0/';

function setupCells() {
  ConfigStore.set('cells', [
    {name: 'us', locality_url: US_URL},
    {name: 'de', locality_url: DE_URL},
  ] as any);
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
      allRegions
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

describe('ResultGrid allRegions', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    setupCells();
  });

  it('merges results from every region and adds a Region column', async () => {
    const usRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme Inc'}],
    });
    const deRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Acme GmbH'}],
    });

    renderGrid();

    expect(await screen.findByText('Acme Inc')).toBeInTheDocument();
    expect(screen.getByText('Acme GmbH')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Region'})).toBeInTheDocument();

    const usRow = screen.getByText('Acme Inc').closest('tr')!;
    expect(within(usRow).getByText('us')).toBeInTheDocument();
    const deRow = screen.getByText('Acme GmbH').closest('tr')!;
    expect(within(deRow).getByText('de')).toBeInTheDocument();

    expect(usRequest).toHaveBeenCalledWith(
      '/_admin/cells/us/customers/',
      expect.objectContaining({host: US_URL})
    );
    expect(deRequest).toHaveBeenCalledWith(
      '/_admin/cells/de/customers/',
      expect.objectContaining({host: DE_URL})
    );
  });

  it('shows per-region result counts', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [
        {id: '1', name: 'Acme Inc'},
        {id: '2', name: 'Acme Labs'},
      ],
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [],
    });

    renderGrid();

    expect(await screen.findByText('us: 2')).toBeInTheDocument();
    expect(screen.getByText('de: 0')).toBeInTheDocument();
  });

  it('sends the search query to every region', async () => {
    const usRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [],
    });
    const deRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '1', name: 'Acme'}],
    });

    renderGrid('acme');

    // The org that lives only in the de region shows up directly.
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    const row = screen.getByText('Acme').closest('tr')!;
    expect(within(row).getByText('de')).toBeInTheDocument();

    expect(usRequest).toHaveBeenCalledWith(
      '/_admin/cells/us/customers/',
      expect.objectContaining({
        data: expect.objectContaining({query: 'acme', cursor: ''}),
      })
    );
    expect(deRequest).toHaveBeenCalledWith(
      '/_admin/cells/de/customers/',
      expect.objectContaining({
        data: expect.objectContaining({query: 'acme', cursor: ''}),
      })
    );
  });

  it('fetches a single region when the Region filter is set', async () => {
    const usRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme Inc'}],
    });
    const deRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Acme GmbH'}],
    });

    renderGrid(undefined, {region: 'de', cursor: '0:100:0'});

    expect(await screen.findByText('Acme GmbH')).toBeInTheDocument();
    expect(usRequest).not.toHaveBeenCalled();
    // Pagination works again and the frontend-only region param is stripped.
    expect(deRequest).toHaveBeenCalledWith(
      '/_admin/cells/de/customers/',
      expect.objectContaining({
        host: DE_URL,
        data: expect.objectContaining({cursor: '0:100:0'}),
      })
    );
    expect(deRequest).toHaveBeenCalledWith(
      '/_admin/cells/de/customers/',
      expect.objectContaining({
        data: expect.not.objectContaining({region: expect.anything()}),
      })
    );
    // Single-region view: no Region column, no per-region chips.
    expect(screen.queryByRole('columnheader', {name: 'Region'})).not.toBeInTheDocument();
    expect(screen.queryByText('de: 1')).not.toBeInTheDocument();
  });

  it('filters client-side when the Region filter is set during a search', async () => {
    const usRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme Inc'}],
    });
    const deRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Acme GmbH'}],
    });

    renderGrid('acme', {region: 'de'});

    expect(await screen.findByText('Acme GmbH')).toBeInTheDocument();
    expect(screen.queryByText('Acme Inc')).not.toBeInTheDocument();
    // Both regions were still queried and stay visible in column + chips.
    expect(usRequest).toHaveBeenCalled();
    expect(deRequest).toHaveBeenCalled();
    expect(screen.getByRole('columnheader', {name: 'Region'})).toBeInTheDocument();
    expect(screen.getByText('us: 1')).toBeInTheDocument();
    expect(screen.getByText('de: 1')).toBeInTheDocument();
  });

  it('changes the Region filter without refetching while a search is active', async () => {
    const usRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme Inc'}],
    });
    const deRequest = MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Acme GmbH'}],
    });

    renderGrid('acme');

    expect(await screen.findByText('Acme Inc')).toBeInTheDocument();
    expect(screen.getByText('Acme GmbH')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /Region/}));
    await userEvent.click(screen.getByRole('option', {name: 'de'}));

    await waitFor(() => expect(screen.queryByText('Acme Inc')).not.toBeInTheDocument());
    expect(screen.getByText('Acme GmbH')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Region'})).toBeInTheDocument();
    expect(usRequest).toHaveBeenCalledTimes(1);
    expect(deRequest).toHaveBeenCalledTimes(1);
  });

  it('still shows results from other regions when one region fails', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '1', name: 'Acme'}],
    });

    renderGrid('acme');

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('us: failed')).toBeInTheDocument();
  });

  it('shows an error when every region fails', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    renderGrid('acme');

    expect(await screen.findByText('Something bad happened :/')).toBeInTheDocument();
  });

  it('flags regions with more matches than one page and hides pagination', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      body: [{id: '1', name: 'Acme Inc'}],
      headers: {
        Link:
          '<https://us.example.com/api/0/_admin/cells/us/customers/?cursor=0:0:1>; ' +
          'rel="previous"; results="false"; cursor="0:0:1", ' +
          '<https://us.example.com/api/0/_admin/cells/us/customers/?cursor=0:100:0>; ' +
          'rel="next"; results="true"; cursor="0:100:0"',
      },
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/de/customers/',
      body: [{id: '2', name: 'Acme GmbH'}],
    });

    renderGrid('acme');

    expect(await screen.findByText('Acme Inc')).toBeInTheDocument();
    expect(screen.getByText('us: 1+')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Next'})).not.toBeInTheDocument();
  });

  it('shows no results only after every region has responded empty', async () => {
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
    expect(screen.getByText('us: 0')).toBeInTheDocument();
    expect(screen.getByText('de: 0')).toBeInTheDocument();
  });
});

describe('ResultGrid probeAllRegions', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    setupCells();
  });

  const allRegionsProps = {allRegions: false, probeAllRegions: true};

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

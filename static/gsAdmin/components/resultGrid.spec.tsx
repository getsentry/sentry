import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

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

function renderGrid(query?: string, extraQuery: Record<string, string> = {}) {
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

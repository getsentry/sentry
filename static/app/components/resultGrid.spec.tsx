import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ResultGrid from 'sentry/components/resultGrid';

describe('ResultGrid', () => {
  const endpoint = '/test-endpoint/';
  const path = '/test/';

  function makeLinkHeader() {
    return (
      '<http://example/?cursor=prev-cursor>; rel="previous"; results="false"; cursor="prev-cursor", ' +
      '<http://example/?cursor=next-cursor>; rel="next"; results="true"; cursor="next-cursor"'
    );
  }

  function renderGrid(extraProps: Partial<React.ComponentProps<typeof ResultGrid>> = {}) {
    return render(
      <ResultGrid
        endpoint={endpoint}
        path={path}
        columns={[<th key="h">Name</th>]}
        keyForRow={row => row.id}
        columnsForRow={row => [<td key="c">{row.name}</td>]}
        defaultSort="id"
        hasSearch
        {...extraProps}
      />
    );
  }

  it('fetches data and renders rows', async () => {
    const rows = [
      {id: '1', name: 'alpha'},
      {id: '2', name: 'beta'},
    ];
    const mock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'GET',
      body: rows,
      headers: {Link: makeLinkHeader()},
    });

    renderGrid();

    expect(await screen.findByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();

    expect(screen.queryByText('Hold on to your butts!')).not.toBeInTheDocument();
    expect(mock).toHaveBeenCalled();
  });

  it('submits search and updates query string', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      method: 'GET',
      body: [],
      headers: {Link: makeLinkHeader()},
    });

    const {router} = renderGrid();

    await userEvent.clear(screen.getByPlaceholderText('search'));
    await userEvent.type(screen.getByPlaceholderText('search'), 'hello');
    await userEvent.click(screen.getByRole('button', {name: 'Search'}));

    await waitFor(() => {
      expect(router.location.query.query).toBe('hello');
    });
  });

  it('renders pagination and navigates to next page', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      method: 'GET',
      body: [],
      headers: {Link: makeLinkHeader()},
    });

    const {router} = renderGrid();

    await screen.findByTestId('pagination');

    const prev = screen.getByRole('button', {name: 'Previous'});
    const next = screen.getByRole('button', {name: 'Next'});
    expect(prev).toBeDisabled();
    expect(next).toBeEnabled();

    await userEvent.click(next);

    await waitFor(() => {
      expect(router.location.query.cursor).toBe('next-cursor');
    });
  });
});

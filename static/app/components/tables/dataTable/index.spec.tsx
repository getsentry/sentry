import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {DataTable} from 'sentry/components/tables/dataTable';

function renderDataTable(body: React.ReactNode) {
  return render(
    <DataTable fields={['a']}>
      <DataTable.Head>
        <DataTable.Row>
          <DataTable.HeadCell>A</DataTable.HeadCell>
        </DataTable.Row>
      </DataTable.Head>
      <DataTable.Body>{body}</DataTable.Body>
    </DataTable>
  );
}

describe('DataTable', () => {
  it('renders the empty state as a cell when there are no rows', () => {
    renderDataTable(<DataTable.Empty>No results</DataTable.Empty>);

    expect(screen.getByRole('cell', {name: 'No results'})).toBeInTheDocument();
  });

  it('renders a loading indicator in a spanning cell when loading', () => {
    renderDataTable(<DataTable.Loading />);

    const cell = screen.getByRole('cell');

    expect(within(cell).getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders a retryable error in a spanning cell when errored', async () => {
    const onRetry = jest.fn();
    renderDataTable(<DataTable.Error message="Failed to load" onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

    expect(screen.getByText('Failed to load')).toBeInTheDocument();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

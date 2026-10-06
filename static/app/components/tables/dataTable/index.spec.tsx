import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {DataTable} from 'sentry/components/tables/dataTable';

function renderDataTable(body: React.ReactNode) {
  return render(
    <DataTable
      columns={[{key: 'a'}]}
      header={
        <DataTable.HeaderRow>
          <DataTable.HeaderCell>A</DataTable.HeaderCell>
        </DataTable.HeaderRow>
      }
    >
      {body}
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

  it('renders resize handles when header cells have column indexes', () => {
    render(
      <DataTable
        columns={[{key: 'a'}, {key: 'b'}]}
        header={
          <DataTable.HeaderRow>
            <DataTable.HeaderCell columnIndex={0}>A</DataTable.HeaderCell>
            <DataTable.HeaderCell columnIndex={1}>B</DataTable.HeaderCell>
          </DataTable.HeaderRow>
        }
      />
    );

    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('sorts when a header cell is clicked', async () => {
    const handleSortClick = jest.fn();
    render(
      <DataTable
        columns={[{key: 'a'}]}
        header={
          <DataTable.HeaderRow>
            <DataTable.HeaderCell handleSortClick={handleSortClick}>
              A
            </DataTable.HeaderCell>
          </DataTable.HeaderRow>
        }
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'A'}));

    expect(handleSortClick).toHaveBeenCalledTimes(1);
  });

  it('renders children as the table sections when given custom sections', () => {
    render(
      <DataTable columns={[{key: 'a'}]} customSections>
        <DataTable.Head>
          <DataTable.HeaderRow>
            <DataTable.HeaderCell>A</DataTable.HeaderCell>
          </DataTable.HeaderRow>
        </DataTable.Head>
        <DataTable.Body data-test-id="pinned">
          <DataTable.Row>
            <DataTable.RowCell>Pinned</DataTable.RowCell>
          </DataTable.Row>
        </DataTable.Body>
        <DataTable.Body data-test-id="rows">
          <DataTable.Row>
            <DataTable.RowCell>Row</DataTable.RowCell>
          </DataTable.Row>
        </DataTable.Body>
      </DataTable>
    );

    expect(screen.getAllByRole('rowgroup')).toHaveLength(3);
    expect(
      within(screen.getByTestId('pinned')).getByRole('cell', {name: 'Pinned'})
    ).toBeInTheDocument();
  });
});

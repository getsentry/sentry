import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {
  COL_WIDTH_UNDEFINED,
  Table,
  type TableColumnConfig,
} from 'sentry/components/tables/table';

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 200},
  {key: 'count', width: 150},
  {key: 'age'},
];

function TestTable({
  columns = COLUMNS,
  ...props
}: Partial<React.ComponentProps<typeof Table>>) {
  return (
    <Table columns={columns} dataRows={1} {...props}>
      <Table.Head>
        <Table.Row>
          {columns.map(column => (
            <Table.HeadCell column={column.key} key={column.key}>
              {column.key}
            </Table.HeadCell>
          ))}
        </Table.Row>
      </Table.Head>
      <Table.Body>
        <Table.Row>
          {columns.map(column => (
            <Table.Cell key={column.key}>{`${column.key}-value`}</Table.Cell>
          ))}
        </Table.Row>
      </Table.Body>
    </Table>
  );
}

function drag(resizer: HTMLElement, from: number, to: number) {
  return userEvent.pointer([
    {keys: '[MouseLeft>]', target: resizer, coords: {clientX: from}},
    {coords: {clientX: to}},
    {keys: '[/MouseLeft]', coords: {clientX: to}},
  ]);
}

function gridTemplate() {
  return screen.getByRole('table').style.gridTemplateColumns;
}

describe('Table', () => {
  it('exposes table semantics when rendered', () => {
    render(<TestTable />);

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(3);
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getAllByRole('cell')).toHaveLength(3);
  });

  it('writes a grid template from the column widths when mounted', () => {
    render(<TestTable />);

    expect(gridTemplate()).toBe('200px 150px minmax(90px, auto)');
  });

  it('makes only the last column flexible when lastColumnFlexible is enabled', () => {
    render(
      <TestTable
        columns={[
          {key: 'a', width: 300},
          {key: 'b', width: 300},
        ]}
      />
    );

    expect(gridTemplate()).toBe('300px minmax(300px, auto)');
  });

  it('keeps every column fixed when lastColumnFlexible is disabled', () => {
    render(
      <TestTable
        columns={[
          {key: 'a', width: 300},
          {key: 'b', width: 300},
        ]}
        lastColumnFlexible={false}
      />
    );

    expect(gridTemplate()).toBe('300px 300px');
  });

  it('raises widths below the minimum up to the minimum', () => {
    render(
      <TestTable
        columns={[
          {key: 'a', width: 10},
          {key: 'b', width: 500},
        ]}
      />
    );

    expect(gridTemplate()).toBe('90px minmax(500px, auto)');
  });

  it('uses string widths verbatim', () => {
    render(<TestTable columns={[{key: 'a', width: 'min-content'}, {key: 'b'}]} />);

    expect(gridTemplate()).toBe('min-content minmax(90px, auto)');
  });

  it('prepends fixed tracks when given prependColumnWidths', () => {
    render(<TestTable prependColumnWidths={['40px', 'min-content']} />);

    expect(gridTemplate()).toBe('40px min-content 200px 150px minmax(90px, auto)');
  });

  it('renders a resize handle for every column except the last', () => {
    render(<TestTable />);

    expect(screen.getAllByTestId('table-column-resizer')).toHaveLength(2);
  });

  it('omits the resize handle when a column is not resizable', () => {
    render(
      <TestTable columns={[{key: 'a'}, {key: 'b', resizable: false}, {key: 'c'}]} />
    );

    expect(screen.getAllByTestId('table-column-resizer')).toHaveLength(1);
  });

  it('writes the dragged width into the grid template while resizing', async () => {
    render(<TestTable />);

    await drag(screen.getAllByTestId('table-column-resizer')[0]!, 100, 400);

    await waitFor(() => expect(gridTemplate()).toBe('300px 150px minmax(90px, auto)'));
  });

  it('clamps a drag below the minimum width up to the minimum', async () => {
    render(<TestTable />);

    await drag(screen.getAllByTestId('table-column-resizer')[0]!, 100, 110);

    await waitFor(() => expect(gridTemplate()).toBe('90px 150px minmax(90px, auto)'));
  });

  it('reports the final width to onColumnResize when a drag ends', async () => {
    const onColumnResize = jest.fn();
    render(<TestTable onColumnResize={onColumnResize} />);

    await drag(screen.getAllByTestId('table-column-resizer')[1]!, 100, 350);

    expect(onColumnResize).toHaveBeenCalledWith(1, 250);
  });

  it('retains the resized width when no onColumnResize is provided', async () => {
    render(<TestTable />);

    await drag(screen.getAllByTestId('table-column-resizer')[0]!, 100, 400);
    await waitFor(() => expect(gridTemplate()).toBe('300px 150px minmax(90px, auto)'));
    await userEvent.click(screen.getByRole('table'));

    expect(gridTemplate()).toBe('300px 150px minmax(90px, auto)');
  });

  it('restores the auto width when a resize handle is double-clicked', async () => {
    render(<TestTable />);

    await userEvent.dblClick(screen.getAllByTestId('table-column-resizer')[0]!);

    await waitFor(() =>
      expect(gridTemplate()).toBe('minmax(90px, auto) 150px minmax(90px, auto)')
    );
  });

  it('reports an undefined width to onColumnResize when a handle is double-clicked', async () => {
    const onColumnResize = jest.fn();
    render(<TestTable onColumnResize={onColumnResize} />);

    await userEvent.dblClick(screen.getAllByTestId('table-column-resizer')[0]!);

    expect(onColumnResize).toHaveBeenCalledWith(0, COL_WIDTH_UNDEFINED);
  });

  it('spans every column when rendering a status row', () => {
    render(
      <Table columns={COLUMNS}>
        <Table.Body>
          <Table.Status>No results</Table.Status>
        </Table.Body>
      </Table>
    );

    expect(screen.getByRole('cell')).toHaveTextContent('No results');
  });
});

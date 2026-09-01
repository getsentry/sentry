import {QueryContainer, setContainerWidth} from 'sentry-test/containerQuery';
import {dragHandle} from 'sentry-test/dragMove';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {COL_WIDTH_UNDEFINED, Table, type TableColumnConfig} from '@sentry/scraps/table';

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
    <Table columns={columns} {...props}>
      <Table.Head>
        <Table.Row>
          {columns.map(column => (
            <Table.HeadCell columnKey={column.key} key={column.key}>
              {column.key}
            </Table.HeadCell>
          ))}
        </Table.Row>
      </Table.Head>
      <Table.Body>
        <Table.Row>
          {columns.map(column => (
            <Table.Cell
              columnKey={column.key}
              key={column.key}
            >{`${column.key}-value`}</Table.Cell>
          ))}
        </Table.Row>
      </Table.Body>
    </Table>
  );
}

const gridTemplate = () => screen.getByRole('table').style.gridTemplateColumns;
const resizers = () => screen.getAllByRole('separator');

describe('Table', () => {
  it('exposes table semantics when rendered', () => {
    render(<TestTable />);

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(3);
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getAllByRole('cell')).toHaveLength(3);
  });

  it.each([
    {
      name: 'sizes declared widths and lets the last column absorb slack',
      columns: COLUMNS,
      expected: '200px 150px minmax(90px, auto)',
    },
    {
      name: 'raises widths below the minimum up to the minimum',
      columns: [{key: 'a', width: 10}, {key: 'b'}],
      expected: '90px minmax(90px, auto)',
    },
    {
      name: 'uses string widths verbatim',
      columns: [{key: 'a', width: 'min-content'}, {key: 'b'}],
      expected: 'min-content minmax(90px, auto)',
    },
  ])('$name', ({columns, expected}) => {
    render(<TestTable columns={columns} />);

    expect(gridTemplate()).toBe(expected);
  });

  it('pins the last column to its declared width when the last column is not flexible', () => {
    render(
      <TestTable
        columns={[
          {key: 'name', width: 200},
          {key: 'count', width: 150},
        ]}
        flexibleLastColumn={false}
      />
    );

    expect(gridTemplate()).toBe('200px 150px');
  });

  it('restores the auto width of a non-flexible column when its handle is double-clicked', async () => {
    render(
      <TestTable
        columns={[{key: 'a', width: 200}, {key: 'b'}]}
        flexibleLastColumn={false}
      />
    );

    await userEvent.dblClick(resizers()[0]!);

    await waitFor(() =>
      expect(gridTemplate()).toBe('minmax(90px, auto) minmax(90px, auto)')
    );
  });

  it('prepends fixed tracks when given prependColumnWidths', () => {
    render(<TestTable prependColumnWidths={['40px', 'min-content']} />);

    expect(gridTemplate()).toBe('40px min-content 200px 150px minmax(90px, auto)');
  });

  it('renders a resize handle for every resizable column except the last', () => {
    render(
      <TestTable columns={[{key: 'a'}, {key: 'b', resizable: false}, {key: 'c'}]} />
    );

    expect(resizers()).toHaveLength(1);
  });

  it('writes the dragged width into the grid template while resizing', async () => {
    render(<TestTable />);

    dragHandle(resizers()[0]!, {from: 100, to: 400});

    await waitFor(() => expect(gridTemplate()).toBe('300px 150px minmax(90px, auto)'));
  });

  it('clamps a drag below the minimum width up to the minimum', async () => {
    render(<TestTable />);

    dragHandle(resizers()[0]!, {from: 100, to: 110});

    await waitFor(() => expect(gridTemplate()).toBe('90px 150px minmax(90px, auto)'));
  });

  it('reports the final width to onColumnResize when a drag ends', () => {
    const onColumnResize = jest.fn();
    render(<TestTable onColumnResize={onColumnResize} />);

    dragHandle(resizers()[1]!, {from: 100, to: 350});

    expect(onColumnResize).toHaveBeenCalledWith(1, 250);
  });

  it('retains the resized width when no onColumnResize is provided', async () => {
    render(<TestTable />);

    dragHandle(resizers()[0]!, {from: 100, to: 400});
    await waitFor(() => expect(gridTemplate()).toBe('300px 150px minmax(90px, auto)'));
    await userEvent.click(screen.getByRole('table'));

    expect(gridTemplate()).toBe('300px 150px minmax(90px, auto)');
  });

  it('restores the auto width when a resize handle is double-clicked', async () => {
    render(<TestTable />);

    await userEvent.dblClick(resizers()[0]!);

    await waitFor(() =>
      expect(gridTemplate()).toBe('minmax(90px, auto) 150px minmax(90px, auto)')
    );
  });

  it('reports an undefined width to onColumnResize when a handle is double-clicked', async () => {
    const onColumnResize = jest.fn();
    render(<TestTable onColumnResize={onColumnResize} />);

    await userEvent.dblClick(resizers()[0]!);

    expect(onColumnResize).toHaveBeenCalledWith(0, COL_WIDTH_UNDEFINED);
  });

  it('places a resize handle in the tab order', async () => {
    render(<TestTable />);

    await userEvent.tab();

    expect(resizers()[0]).toHaveFocus();
  });

  it('exposes a resize handle as a vertical separator', () => {
    render(<TestTable />);

    expect(resizers()[0]).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('names each resize handle after the column it resizes', () => {
    render(<TestTable />);

    expect(resizers()[0]).toHaveAccessibleName('name');
    expect(resizers()[1]).toHaveAccessibleName('count');
  });

  it('leaves each header cell named by its own content', () => {
    render(<TestTable />);

    expect(screen.getAllByRole('columnheader')[0]).toHaveAccessibleName('name');
  });

  it('commits a resize when a focused handle is arrowed', async () => {
    const onColumnResize = jest.fn();
    render(<TestTable onColumnResize={onColumnResize} />);

    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');

    expect(onColumnResize).toHaveBeenCalledWith(0, 90);
  });

  it('does not commit a resize when a handle is right-clicked', () => {
    const onColumnResize = jest.fn();
    render(<TestTable onColumnResize={onColumnResize} />);

    dragHandle(resizers()[0]!, {button: 2, from: 100, to: 400});

    expect(onColumnResize).not.toHaveBeenCalled();
  });

  it('keeps the in-progress width when an unrelated re-render lands mid-drag', async () => {
    const {rerender} = render(<TestTable aria-label="before" />);

    dragHandle(resizers()[0]!, {from: 100, to: 400, release: false});
    await waitFor(() => expect(gridTemplate()).toBe('300px 150px minmax(90px, auto)'));

    rerender(<TestTable columns={[...COLUMNS]} aria-label="after" />);

    expect(screen.getByRole('table')).toHaveAttribute('aria-label', 'after');
    expect(gridTemplate()).toBe('300px 150px minmax(90px, auto)');
  });

  describe('responsive columns', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const RESPONSIVE_COLUMNS: TableColumnConfig[] = [
      {key: 'name', width: {zero: 120, xl: 200}},
      {key: 'age', visible: {zero: false, xl: true}, width: 150},
      {key: 'count'},
    ];

    it('sizes a column by the width its container width resolves to', () => {
      // Container scale: xl = 768px, 2xl = 896px -> 800px resolves to xl.
      setContainerWidth(800);
      render(
        <QueryContainer>
          <TestTable columns={RESPONSIVE_COLUMNS} />
        </QueryContainer>
      );

      expect(gridTemplate()).toBe('200px 150px minmax(90px, auto)');
    });

    it('drops the track of a column hidden at the container width', () => {
      setContainerWidth(400);
      render(
        <QueryContainer>
          <TestTable columns={RESPONSIVE_COLUMNS} />
        </QueryContainer>
      );

      expect(gridTemplate()).toBe('120px minmax(90px, auto)');
    });

    it('hides the cells of a column hidden at the container width', () => {
      setContainerWidth(400);
      render(
        <QueryContainer>
          <TestTable columns={RESPONSIVE_COLUMNS} />
        </QueryContainer>
      );

      expect(screen.getByText('age-value')).not.toBeVisible();
      expect(screen.getByText('name-value')).toBeVisible();
    });

    it('leaves the last visible column flexible when a later column is hidden', () => {
      setContainerWidth(400);
      render(
        <QueryContainer>
          <TestTable
            columns={[
              {key: 'name', width: 120},
              {key: 'age', visible: {zero: false, xl: true}, width: 150},
            ]}
          />
        </QueryContainer>
      );

      expect(gridTemplate()).toBe('minmax(120px, auto)');
    });

    it('omits the resize handle of a column hidden at the container width', () => {
      setContainerWidth(400);
      render(
        <QueryContainer>
          <TestTable columns={RESPONSIVE_COLUMNS} />
        </QueryContainer>
      );

      expect(resizers()).toHaveLength(1);
      expect(resizers()[0]).toHaveAccessibleName('name');
    });

    it('reports the visible index of a resized column to onColumnResize', () => {
      const onColumnResize = jest.fn();
      setContainerWidth(400);
      render(
        <QueryContainer>
          <TestTable
            columns={[
              {key: 'name', visible: {zero: false, xl: true}, width: 200},
              {key: 'age', width: 150},
              {key: 'count'},
            ]}
            onColumnResize={onColumnResize}
          />
        </QueryContainer>
      );

      dragHandle(resizers()[0]!, {from: 100, to: 350});

      expect(onColumnResize).toHaveBeenCalledWith(0, 250);
    });
  });

  it('leaves consumer-provided tracks alone when no columns are described', () => {
    render(
      <Table style={{gridTemplateColumns: '1fr 2fr'}}>
        <Table.Body>
          <Table.Status>No results</Table.Status>
        </Table.Body>
      </Table>
    );

    expect(gridTemplate()).toBe('1fr 2fr');
    expect(screen.getByRole('cell')).toHaveTextContent('No results');
  });
});

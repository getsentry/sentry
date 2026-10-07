import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {SimpleTable} from 'sentry/components/tables/simpleTable';

describe('SimpleTable component', () => {
  it('renders headers and cells', () => {
    render(
      <SimpleTable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>A</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>B</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>C</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        <SimpleTable.Row data-test-id="row-1">
          <SimpleTable.RowCell>0</SimpleTable.RowCell>
          <SimpleTable.RowCell>1</SimpleTable.RowCell>
          <SimpleTable.RowCell>2</SimpleTable.RowCell>
        </SimpleTable.Row>
        <SimpleTable.Row data-test-id="row-2">
          <SimpleTable.RowCell>3</SimpleTable.RowCell>
          <SimpleTable.RowCell>4</SimpleTable.RowCell>
          <SimpleTable.RowCell>5</SimpleTable.RowCell>
        </SimpleTable.Row>
      </SimpleTable>
    );

    expect(screen.getByRole('columnheader', {name: 'A'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'B'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'C'})).toBeInTheDocument();

    const row1 = screen.getByTestId('row-1');
    expect(within(row1).getByRole('cell', {name: '0'})).toBeInTheDocument();
    expect(within(row1).getByRole('cell', {name: '1'})).toBeInTheDocument();
    expect(within(row1).getByRole('cell', {name: '2'})).toBeInTheDocument();

    const row2 = screen.getByTestId('row-2');
    expect(within(row2).getByRole('cell', {name: '3'})).toBeInTheDocument();
    expect(within(row2).getByRole('cell', {name: '4'})).toBeInTheDocument();
    expect(within(row2).getByRole('cell', {name: '5'})).toBeInTheDocument();
  });

  it('announces the sort direction when a column is sorted', () => {
    render(
      <SimpleTable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell sort="asc" handleSortClick={jest.fn()}>
              A
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell handleSortClick={jest.fn()}>B</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      />
    );

    expect(screen.getByRole('columnheader', {name: 'A'})).toHaveAttribute(
      'aria-sort',
      'ascending'
    );
    expect(screen.getByRole('columnheader', {name: 'B'})).not.toHaveAttribute(
      'aria-sort'
    );
  });

  it('keeps the interaction state layer a direct child of the sort button when sortable', () => {
    render(
      <SimpleTable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell handleSortClick={jest.fn()}>A</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      />
    );

    const button = screen.getByRole('button', {name: 'A'});

    expect(within(button).getByRole('presentation').parentElement).toBe(button);
  });

  it('sorts when a sortable header is clicked', async () => {
    const handleSortClick = jest.fn();
    render(
      <SimpleTable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell handleSortClick={handleSortClick}>
              A
            </SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'A'}));

    expect(handleSortClick).toHaveBeenCalledTimes(1);
  });

  it('renders a sortable header as a button inside a real column header', () => {
    render(
      <SimpleTable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell handleSortClick={jest.fn()}>A</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      />
    );

    const header = screen.getByRole('columnheader', {name: 'A'});

    expect(header.tagName).toBe('TH');
    expect(within(header).getByRole('button', {name: 'A'})).toBeInTheDocument();
  });

  it('centers a column header through styles rather than a DOM attribute', () => {
    render(
      <SimpleTable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell align="center">A</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      />
    );

    const header = screen.getByRole('columnheader', {name: 'A'});
    const content = within(header).getByText('A').parentElement!;

    expect(header).not.toHaveAttribute('align');
    expect(getEmotionRules(content).join('')).toContain('justify-content: center');
  });

  it('renders a single spanning cell when given a full width row', () => {
    render(
      <SimpleTable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>A</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>B</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        <SimpleTable.FullWidthRow data-test-id="banner">Banner</SimpleTable.FullWidthRow>
      </SimpleTable>
    );

    const row = screen.getByTestId('banner');

    expect(within(row).getAllByRole('cell')).toHaveLength(1);
    expect(within(row).getByRole('cell', {name: 'Banner'})).toBeInTheDocument();
  });

  it('renders a loading indicator in a spanning cell when loading', () => {
    render(
      <SimpleTable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>A</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        <SimpleTable.Loading />
      </SimpleTable>
    );

    const cell = screen.getByRole('cell');

    expect(within(cell).getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders a retryable error in a spanning cell when errored', async () => {
    const onRetry = jest.fn();
    render(
      <SimpleTable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>A</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        <SimpleTable.Error message="Failed to load" onRetry={onRetry} />
      </SimpleTable>
    );
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

    expect(screen.getByText('Failed to load')).toBeInTheDocument();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders the empty state as a cell when there are no rows', () => {
    render(
      <SimpleTable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>A</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        <SimpleTable.Empty>No results</SimpleTable.Empty>
      </SimpleTable>
    );

    expect(screen.getByRole('cell', {name: 'No results'})).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', {name: 'No results'})
    ).not.toBeInTheDocument();
  });

  it('renders children as the table sections when given custom sections', () => {
    render(
      <SimpleTable customSections>
        <SimpleTable.Head>
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>A</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        </SimpleTable.Head>
        <SimpleTable.Body data-test-id="pinned">
          <SimpleTable.Row>
            <SimpleTable.RowCell>Pinned</SimpleTable.RowCell>
          </SimpleTable.Row>
        </SimpleTable.Body>
        <SimpleTable.Body data-test-id="rows">
          <SimpleTable.Row>
            <SimpleTable.RowCell>Row</SimpleTable.RowCell>
          </SimpleTable.Row>
        </SimpleTable.Body>
      </SimpleTable>
    );

    expect(screen.getAllByRole('rowgroup')).toHaveLength(3);
    expect(
      within(screen.getByTestId('pinned')).getByRole('cell', {name: 'Pinned'})
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('rows')).getByRole('cell', {name: 'Row'})
    ).toBeInTheDocument();
  });

  it('renders only a body when no header is given', () => {
    render(
      <SimpleTable>
        <SimpleTable.Row>
          <SimpleTable.RowCell>Row</SimpleTable.RowCell>
        </SimpleTable.Row>
      </SimpleTable>
    );

    expect(screen.getAllByRole('rowgroup')).toHaveLength(1);
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
  });

  it('renders resize handles only for columns that opt in', () => {
    render(
      <SimpleTable
        columns={[{key: 'a', resizable: true}, {key: 'b'}, {key: 'c'}]}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell columnIndex={0}>A</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell columnIndex={1}>B</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell columnIndex={2}>C</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        <SimpleTable.Row>
          <SimpleTable.RowCell>0</SimpleTable.RowCell>
          <SimpleTable.RowCell>1</SimpleTable.RowCell>
          <SimpleTable.RowCell>2</SimpleTable.RowCell>
        </SimpleTable.Row>
      </SimpleTable>
    );

    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('scrolls its overflow and caps its height when scrollable with a max height', () => {
    render(
      <SimpleTable maxHeight="200px" scrollable>
        <SimpleTable.Row>
          <SimpleTable.RowCell>Row</SimpleTable.RowCell>
        </SimpleTable.Row>
      </SimpleTable>
    );

    const rules = getEmotionRules(screen.getByRole('table')).join('');

    expect(rules).toContain('overflow: auto');
    expect(rules).toContain('max-height: 200px');
  });

  it('clips its overflow when not scrollable', () => {
    render(
      <SimpleTable>
        <SimpleTable.Row>
          <SimpleTable.RowCell>Row</SimpleTable.RowCell>
        </SimpleTable.Row>
      </SimpleTable>
    );

    const rules = getEmotionRules(screen.getByRole('table')).join('');

    expect(rules).toContain('overflow: hidden');
    expect(rules).not.toContain('grid-template-rows');
  });
});

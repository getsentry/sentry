import {render, screen} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {DataGrid, type GridColumnOrder} from 'sentry/components/tables/dataGrid';

type Row = {count: number; name: string};

const DATA: Row[] = [{name: 'first', count: 1}];

const COLUMN_ORDER: Array<GridColumnOrder<keyof Row>> = [
  {key: 'name', name: 'Name'},
  {key: 'count', name: 'Count'},
];

describe('DataGrid', () => {
  it('announces descending when a column is sorted descending', () => {
    render(
      <DataGrid
        columnOrder={COLUMN_ORDER}
        data={DATA}
        grid={{
          getColumnSort: column => ({
            direction: column.key === 'count' ? 'desc' : undefined,
          }),
        }}
      />
    );

    expect(screen.getByRole('columnheader', {name: 'Count'})).toHaveAttribute(
      'aria-sort',
      'descending'
    );
    expect(screen.getByRole('columnheader', {name: 'Name'})).not.toHaveAttribute(
      'aria-sort'
    );
  });

  it('announces ascending when a column is sorted ascending', () => {
    render(
      <DataGrid
        columnOrder={COLUMN_ORDER}
        data={DATA}
        grid={{
          getColumnSort: column => ({
            direction: column.key === 'name' ? 'asc' : undefined,
          }),
        }}
      />
    );

    expect(screen.getByRole('columnheader', {name: 'Name'})).toHaveAttribute(
      'aria-sort',
      'ascending'
    );
  });

  it('announces no sort when the table is unsorted', () => {
    render(<DataGrid columnOrder={COLUMN_ORDER} data={DATA} grid={{}} />);

    expect(screen.getByRole('columnheader', {name: 'Count'})).not.toHaveAttribute(
      'aria-sort'
    );
  });

  it('renders resize handles for every column but the last when resizable', () => {
    render(<DataGrid columnOrder={COLUMN_ORDER} data={DATA} grid={{}} />);

    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('sizes unsized columns to their content when fit to max content', () => {
    render(
      <DataGrid columnOrder={COLUMN_ORDER} data={DATA} fit="max-content" grid={{}} />
    );

    expect(screen.getByRole('table')).toHaveStyle({
      gridTemplateColumns: 'minmax(max-content, auto) minmax(max-content, auto)',
    });
  });

  it('stretches body cell content across the cell', () => {
    render(<DataGrid columnOrder={COLUMN_ORDER} data={DATA} grid={{}} />);

    const rules = getEmotionRules(screen.getByRole('cell', {name: 'first'})).join('');

    expect(rules).toContain('flex-direction: column');
    expect(rules).toContain('align-items: stretch');
  });
});

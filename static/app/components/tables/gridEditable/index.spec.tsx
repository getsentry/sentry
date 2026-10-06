import {render, screen} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';
import {GridEditable} from 'sentry/components/tables/gridEditable';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

type Row = {count: number; name: string};

const DATA: Row[] = [{name: 'first', count: 1}];

const COLUMN_ORDER: Array<GridColumnOrder<keyof Row>> = [
  {key: 'name', name: 'Name'},
  {key: 'count', name: 'Count'},
];

describe('GridEditable', () => {
  it('announces descending when a column is sorted descending', () => {
    render(
      <GridEditable
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
      <GridEditable
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
    render(<GridEditable columnOrder={COLUMN_ORDER} data={DATA} grid={{}} />);

    expect(screen.getByRole('columnheader', {name: 'Count'})).not.toHaveAttribute(
      'aria-sort'
    );
  });

  it('renders uppercase results headers when outside a variant provider', () => {
    render(<GridEditable columnOrder={COLUMN_ORDER} data={DATA} grid={{}} />);

    const head = screen.getAllByRole('rowgroup')[0]!;

    expect(getEmotionRules(head).join('')).toContain('text-transform: uppercase');
  });

  it('renders default table headers when inside a default variant provider', () => {
    render(
      <SimpleTable.VariantProvider variant="default">
        <GridEditable columnOrder={COLUMN_ORDER} data={DATA} grid={{}} />
      </SimpleTable.VariantProvider>
    );

    const head = screen.getAllByRole('rowgroup')[0]!;

    expect(getEmotionRules(head).join('')).not.toContain('text-transform: uppercase');
    expect(screen.getByRole('columnheader', {name: 'Count'})).toBeInTheDocument();
  });
});

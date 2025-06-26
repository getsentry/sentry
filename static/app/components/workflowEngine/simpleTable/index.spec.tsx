import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {SimpleTable} from 'sentry/components/workflowEngine/simpleTable';

describe('SimpleTable component', function () {
  it('renders headers andcells', function () {
    render(
      <SimpleTable>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell>A</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>B</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>C</SimpleTable.HeaderCell>
        </SimpleTable.Header>
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
});

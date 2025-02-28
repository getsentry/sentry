import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SimpleTable} from 'sentry/components/workflowEngine/simpleTable';

function col(label: string) {
  return {
    Header: () => label,
  };
}
function cell(output: string) {
  return {
    Header: () => 'header',
    Cell: ({value}: any) => `${output}: ${value}`,
  };
}
describe('SimpleTable component', function () {
  it('renders cells', function () {
    render(
      <SimpleTable
        data={[
          {a: 0, b: 1, c: 2},
          {a: 3, b: 4, c: 5},
        ]}
      />
    );

    expect(screen.getByRole('cell', {name: '0'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '1'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '2'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '3'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '4'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '5'})).toBeInTheDocument();
  });

  it('renders headers without config', function () {
    render(
      <SimpleTable
        data={[
          {a: 0, b: 1, c: 2},
          {a: 1, b: 2, c: 3},
        ]}
      />
    );

    expect(screen.getByRole('columnheader', {name: 'a'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'b'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'c'})).toBeInTheDocument();
  });

  it('renders with custom headers', function () {
    render(
      <SimpleTable
        columns={{a: col('A'), b: col('B'), c: col('C')}}
        data={[
          {a: 0, b: 1, c: 2},
          {a: 1, b: 2, c: 3},
        ]}
      />
    );

    expect(screen.getByRole('columnheader', {name: 'A'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'B'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'C'})).toBeInTheDocument();
  });

  it('renders with custom cells', function () {
    render(
      <SimpleTable
        columns={{a: cell('test-cell-a'), b: cell('test-cell-b'), c: cell('test-cell-c')}}
        data={[
          {a: 0, b: 1, c: 2},
          {a: 1, b: 2, c: 3},
        ]}
      />
    );

    expect(screen.getByRole('cell', {name: 'test-cell-a: 0'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'test-cell-b: 1'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'test-cell-c: 2'})).toBeInTheDocument();
  });
});

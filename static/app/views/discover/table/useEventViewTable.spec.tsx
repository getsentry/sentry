import {LocationFixture} from 'sentry-fixture/locationFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GridEditable} from 'sentry/components/tables/gridEditable';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {EventView} from 'sentry/utils/discover/eventView';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {
  useEventViewTable,
  type RenderCellOptions,
} from 'sentry/views/discover/table/useEventViewTable';

const makeLocation = (fields: string[]) => LocationFixture({query: {field: fields}});

type TableOptions = Omit<
  Parameters<typeof useEventViewTable>[0],
  'eventView' | 'getCellActionHandler' | 'location'
>;

function TestTable({
  fields,
  tableData,
  renderCell = ({rendered, wrap}: RenderCellOptions) => wrap(rendered),
  ...options
}: Partial<TableOptions> & {
  fields: string[];
  tableData: TableData;
}) {
  const location = makeLocation(fields);

  const {columnOrder, getGrid} = useEventViewTable({
    eventView: EventView.fromLocation(location),
    getCellActionHandler: () => () => {},
    location,
    renderCell,
    ...options,
  });

  return (
    <GridEditable
      data={tableData.data}
      columnOrder={columnOrder}
      grid={getGrid(tableData.meta)}
    />
  );
}

const renderPlainCell = ({wrap}: RenderCellOptions) => wrap('cell');

describe('useEventViewTable', () => {
  it('renders each body cell through the field renderer for its column', () => {
    render(
      <TestTable
        fields={['count()']}
        tableData={{data: [{id: '1', 'count()': 1200}], meta: {'count()': 'integer'}}}
      />
    );

    expect(screen.getByText('1.2K')).toBeInTheDocument();
  });

  describe('integer tooltip', () => {
    it('shows the unabbreviated value when an integer cell exceeds 999', async () => {
      render(
        <TestTable
          fields={['count()']}
          renderCell={renderPlainCell}
          tableData={{data: [{id: '1', 'count()': 1200}], meta: {'count()': 'integer'}}}
        />
      );

      await userEvent.hover(screen.getByText('cell'));

      expect(await screen.findByText('1,200')).toBeInTheDocument();
    });

    it('shows no tooltip when an integer cell is 999 or less', async () => {
      render(
        <TestTable
          fields={['count()']}
          renderCell={renderPlainCell}
          tableData={{data: [{id: '1', 'count()': 999}], meta: {'count()': 'integer'}}}
        />
      );

      await userEvent.hover(screen.getByText('cell'));

      expect(screen.queryByText('999')).not.toBeInTheDocument();
    });

    it('reads the value by its aggregate alias when getValueKey maps the column key', async () => {
      render(
        <TestTable
          fields={['count()']}
          getValueKey={getAggregateAlias}
          renderCell={renderPlainCell}
          tableData={{data: [{id: '1', count: 1200}], meta: {count: 'integer'}}}
        />
      );

      await userEvent.hover(screen.getByText('cell'));

      expect(await screen.findByText('1,200')).toBeInTheDocument();
    });

    it('does not find an alias-keyed value when getValueKey is omitted', async () => {
      render(
        <TestTable
          fields={['count()']}
          renderCell={renderPlainCell}
          tableData={{data: [{id: '1', count: 1200}], meta: {count: 'integer'}}}
        />
      );

      await userEvent.hover(screen.getByText('cell'));

      expect(screen.queryByText('1,200')).not.toBeInTheDocument();
    });
  });

  describe('column sorting', () => {
    it('links the header to the sorted query when the column is sortable', () => {
      render(
        <TestTable
          fields={['count()']}
          tableData={{data: [], meta: {'count()': 'integer'}}}
        />
      );

      expect(screen.getByRole('link', {name: 'count()'})).toHaveAttribute(
        'href',
        expect.stringContaining('sort=-count')
      );
    });

    it('does not link the header when canSort returns false', () => {
      render(
        <TestTable
          canSort={() => false}
          fields={['count()']}
          tableData={{data: [], meta: {'count()': 'integer'}}}
        />
      );

      expect(screen.queryByRole('link', {name: 'count()'})).not.toBeInTheDocument();
    });

    it('builds the sort target from makeQuery when one is provided', () => {
      render(
        <TestTable
          fields={['count()']}
          makeQuery={queryStringObject => ({
            extra: 'kept',
            sort: queryStringObject.sort,
          })}
          tableData={{data: [], meta: {'count()': 'integer'}}}
        />
      );

      expect(screen.getByRole('link', {name: 'count()'})).toHaveAttribute(
        'href',
        expect.stringContaining('extra=kept')
      );
    });
  });
});

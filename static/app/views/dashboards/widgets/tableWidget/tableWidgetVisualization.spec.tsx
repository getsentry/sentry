import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TabularColumnsFixture} from 'sentry-fixture/tabularColumns';
import {ThemeFixture} from 'sentry-fixture/theme';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {IconArrow} from 'sentry/icons';
import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import type {
  TabularColumn,
  TabularData,
  TabularRow,
} from 'sentry/views/dashboards/widgets/common/types';
import {sampleHTTPRequestTableData} from 'sentry/views/dashboards/widgets/tableWidget/fixtures/sampleHTTPRequestTableData';
import type {FieldRenderer} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';
import {TableWidgetVisualization} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';
import {Actions} from 'sentry/views/discover/table/cellAction';

jest.mock('sentry/icons/iconArrow', () => ({
  IconArrow: jest.fn(() => <div />),
}));

describe('TableWidgetVisualization', () => {
  const columns: Array<Partial<TabularColumn>> = [
    {
      key: 'count(span.duration)',
    },
    {
      key: 'http.request_method',
    },
  ];
  const sortableColumns = columns.map(column => ({...column, sortable: true}));

  describe('Basic table functionality', () => {
    it('Renders correctly', async () => {
      render(<TableWidgetVisualization tableData={sampleHTTPRequestTableData} />);

      expect(await screen.findByText('http.request_method')).toBeInTheDocument();
      expect(await screen.findByText('count(span.duration)')).toBeInTheDocument();
      expect(await screen.findByText('PATCH')).toBeInTheDocument();
      expect(await screen.findByText('14k')).toBeInTheDocument();
    });

    it('Applies custom order and column name if provided', () => {
      render(
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          columns={TabularColumnsFixture(columns)}
        />
      );

      const $headers = screen.getAllByRole('columnheader');
      expect($headers[0]).toHaveTextContent(columns[0]!.key!);
      expect($headers[1]).toHaveTextContent(columns[1]!.key!);
    });

    it('Renders unique number fields correctly', async () => {
      const tableData: TabularData = {
        data: [{'span.duration': 123, failure_rate: 0.1, epm: 6}],
        meta: {
          fields: {'span.duration': 'duration', failure_rate: 'percentage', epm: 'rate'},
          units: {
            'span.duration': DurationUnit.MILLISECOND,
            failure_rate: null,
            epm: RateUnit.PER_MINUTE,
          },
        },
      };
      render(<TableWidgetVisualization tableData={tableData} />);

      expect(await screen.findByText('span.duration')).toBeInTheDocument();
      expect(await screen.findByText('failure_rate')).toBeInTheDocument();
      expect(await screen.findByText('epm')).toBeInTheDocument();

      expect(await screen.findByText('123.00ms')).toBeInTheDocument();
      expect(await screen.findByText('10%')).toBeInTheDocument();
      expect(await screen.findByText('6.00/min')).toBeInTheDocument();
    });

    it('Uses custom renderer over fallback renderer', async () => {
      const tableData: TabularData = {
        data: [{date: '2025-06-20T15:14:52+00:00'}],
        meta: {
          fields: {date: 'date'},
          units: {
            date: null,
          },
        },
      };

      function getRenderer(fieldName: string): FieldRenderer {
        if (fieldName === 'date') {
          return (_dataRow: TabularRow, baggage: RenderFunctionBaggage) => {
            if (baggage.projectSlug === 'sentry') {
              return 'relax, soon';
            }

            return 'soon';
          };
        }

        return dataRow => dataRow[fieldName];
      }

      function makeBaggage(): RenderFunctionBaggage {
        return {
          location: LocationFixture(),
          organization: OrganizationFixture(),
          theme: ThemeFixture(),
          projectSlug: 'sentry',
        };
      }

      render(
        <TableWidgetVisualization
          tableData={tableData}
          makeBaggage={makeBaggage}
          getRenderer={getRenderer}
        />
      );

      const $cells = await screen.findAllByRole('cell');
      expect($cells[0]).toHaveTextContent('relax, soon');
    });

    it('Uses aliases for column names if supplied', () => {
      const aliases = {
        'count(span.duration)': 'span duration count',
        'http.request_method': 'request method http',
      };
      render(
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          aliases={aliases}
          columns={TabularColumnsFixture(columns)}
        />
      );

      const $headers = screen.getAllByRole('columnheader');
      expect($headers[0]).toHaveTextContent(aliases['count(span.duration)']);
      expect($headers[1]).toHaveTextContent(aliases['http.request_method']);
    });
  });

  describe('Sorting functionality', () => {
    it('Sort URL parameter is set and correct arrow direction appears on column header click', async () => {
      const {router: testRouter} = render(
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          columns={TabularColumnsFixture(sortableColumns)}
        />,
        {
          initialRouterConfig: {},
        }
      );

      const $header = screen.getAllByRole('columnheader')[0]?.children[0]!;
      await userEvent.click($header);
      await waitFor(() =>
        expect(IconArrow).toHaveBeenCalledWith(
          expect.objectContaining({direction: 'down'}),
          undefined
        )
      );
      await waitFor(() =>
        expect(testRouter.location.query.sort).toBe('-count(span.duration)')
      );
    });

    it('Sort arrow appears and has correct direction if sort is provided', async () => {
      render(
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          sort={{field: 'count(span.duration)', kind: 'asc'}}
          columns={TabularColumnsFixture(sortableColumns)}
        />
      );

      await waitFor(() =>
        expect(IconArrow).toHaveBeenCalledWith(
          expect.objectContaining({direction: 'up'}),
          undefined
        )
      );
    });

    it('Uses onChangeSort if supplied on column header click', async () => {
      const onChangeSortMock = jest.fn((_sort: Sort) => {});
      render(
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          onChangeSort={onChangeSortMock}
          columns={TabularColumnsFixture(sortableColumns)}
        />
      );
      const $header = screen.getAllByRole('columnheader')[0]?.children[0]!;
      await userEvent.click($header);
      await waitFor(() =>
        expect(onChangeSortMock).toHaveBeenCalledWith({
          field: 'count(span.duration)',
          kind: 'desc',
        })
      );
    });
  });

  describe('Column resizing functionality', () => {
    it('Width URL parameter is set as default on column resize', async () => {
      const {router: testRouter} = render(
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          columns={TabularColumnsFixture(columns)}
        />,
        {
          initialRouterConfig: {},
        }
      );

      const $gridResizer = screen.getAllByRole('columnheader')[0]?.children[1]!;
      await userEvent.pointer([
        {keys: '[MouseLeft>]', target: $gridResizer},
        {target: $gridResizer, coords: {x: 100}},
        {keys: '[/MouseLeft]'},
      ]);
      await waitFor(() =>
        expect(testRouter.location.query.width).toStrictEqual(['100', '-1'])
      );
    });

    it('Uses onChangeResizeColumn if supplied on column resize', async () => {
      const onResizeColumnMock = jest.fn((_columns: TabularColumn[]) => {});
      render(
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          onResizeColumn={onResizeColumnMock}
        />
      );

      const $gridResizer = screen.getAllByRole('columnheader')[0]?.children[1]!;
      await userEvent.pointer([
        {keys: '[MouseLeft>]', target: $gridResizer},
        {target: $gridResizer, coords: {x: 100}},
        {keys: '[/MouseLeft]'},
      ]);
      await waitFor(() =>
        expect(onResizeColumnMock).toHaveBeenCalledWith([
          {
            key: 'http.request_method',
            type: 'string',
            width: 100,
          },
          {
            key: 'count(span.duration)',
            type: 'integer',
            width: -1,
          },
        ])
      );
    });
  });

  describe('Cell actions functionality', () => {
    it('Renders default action', async () => {
      render(<TableWidgetVisualization tableData={sampleHTTPRequestTableData} />);

      const $cell = screen.getAllByRole('button')[0]!;
      await userEvent.click($cell);
      await screen.findByText('Copy to clipboard');
    });

    it('Renders custom cell actions from allowedCellActions if supplied', async () => {
      render(
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          allowedCellActions={[Actions.ADD]}
        />
      );
      const $cell = screen.getAllByRole('button')[0]!;
      await userEvent.click($cell);
      await screen.findByText('Add to filter');
    });

    it('Calls allowedCellActions with correct cellInfo', () => {
      const allowedCellActions = jest.fn(() => [Actions.ADD]);

      render(
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          allowedCellActions={allowedCellActions}
        />
      );

      expect(allowedCellActions).toHaveBeenCalledWith(
        expect.objectContaining({
          column: expect.objectContaining({key: 'http.request_method'}),
          dataRow: expect.objectContaining(sampleHTTPRequestTableData.data[0]!),
          columnIndex: 0,
          rowIndex: 0,
        })
      );
    });

    it('Renders per-cell actions from allowedCellActions', async () => {
      const allowedCellActions = jest.fn(({column}: {column: TabularColumn}) =>
        column.type === 'integer' ? [Actions.SHOW_GREATER_THAN] : [Actions.ADD]
      );

      render(
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          allowedCellActions={allowedCellActions}
        />
      );

      const cells = screen.getAllByRole('cell');
      const stringCellTrigger = within(cells[0]!).getByRole('button');
      await userEvent.click(stringCellTrigger);
      expect(await screen.findByText('Add to filter')).toBeInTheDocument();
      expect(screen.queryByText('Show values greater than')).not.toBeInTheDocument();
      await userEvent.keyboard('{Escape}');

      const numberCellTrigger = within(cells[1]!).getByRole('button');
      await userEvent.click(numberCellTrigger);
      expect(await screen.findByText('Show values greater than')).toBeInTheDocument();
      expect(screen.queryByText('Add to filter')).not.toBeInTheDocument();
    });

    it('Uses onTriggerCellAction if supplied on action click', async () => {
      const onTriggerCellActionMock = jest.fn(
        (_actions: Actions, _value: string | number, _dataRow: TabularRow) => {}
      );
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn(() => Promise.resolve()),
        },
      });

      render(
        <TableWidgetVisualization
          tableData={sampleHTTPRequestTableData}
          onTriggerCellAction={onTriggerCellActionMock}
        />
      );

      const $cell = screen.getAllByRole('button')[0]!;
      await userEvent.click($cell);
      const $option = screen.getAllByRole('menuitemradio')[0]!;
      await userEvent.click($option);
      await waitFor(() =>
        expect(onTriggerCellActionMock).toHaveBeenCalledWith(
          Actions.COPY_TO_CLIPBOARD,
          sampleHTTPRequestTableData.data[0]!['http.request_method'],
          sampleHTTPRequestTableData.data[0]
        )
      );
    });
  });
});

import {TabularColumnsFixture} from 'sentry-fixture/tabularColumns';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import type {
  TabularColumn,
  TabularData,
  TabularRow,
} from 'sentry/views/dashboards/widgets/common/types';
import {sampleHTTPRequestTableData} from 'sentry/views/dashboards/widgets/tableWidget/fixtures/sampleHTTPRequestTableData';
import {TableWidgetVisualization} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';

describe('TableWidgetVisualization', function () {
  it('Basic table renders correctly', async function () {
    render(<TableWidgetVisualization tableData={sampleHTTPRequestTableData} />);

    expect(await screen.findByText('http.request_method')).toBeInTheDocument();
    expect(await screen.findByText('count(span.duration)')).toBeInTheDocument();
  });

  it('Table applies custom order and column name if provided', function () {
    const columns: Array<Partial<TabularColumn>> = [
      {
        key: 'count(span.duration)',
        name: 'Count of Span Duration',
      },
      {
        key: 'http.request_method',
        name: 'HTTP Request Method',
      },
    ];

    render(
      <TableWidgetVisualization
        tableData={sampleHTTPRequestTableData}
        columns={TabularColumnsFixture(columns)}
      />
    );

    const headers = screen.getAllByTestId('grid-head-cell');
    expect(headers[0]?.children[0]?.textContent).toEqual(columns[0]?.name);
    expect(headers[1]?.children[0]?.textContent).toEqual(columns[1]?.name);
  });

  it('Table renders unique number fields correctly', async function () {
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

  it('Table uses custom renderer over fallback renderer correctly', async function () {
    const tableData: TabularData = {
      data: [{date: '2025-06-20T15:14:52+00:00'}],
      meta: {
        fields: {date: 'date'},
        units: {
          date: null,
        },
      },
    };

    function customDateHeadRenderer(
      column: TabularColumn<keyof TabularRow>,
      _columnIndex: number
    ) {
      return <div>{column.name + ' column'}</div>;
    }

    function customDateBodyRenderer(
      column: TabularColumn,
      dataRow: TabularRow,
      _rowIndex: number,
      _columnIndex: number
    ) {
      return <div>{dataRow[column.key]}</div>;
    }

    render(
      <TableWidgetVisualization
        tableData={tableData}
        renderTableHeadCell={customDateHeadRenderer}
        renderTableBodyCell={customDateBodyRenderer}
      />
    );

    expect(await screen.findByText('date column')).toBeInTheDocument();
    expect(await screen.findByText('2025-06-20T15:14:52+00:00')).toBeInTheDocument();
  });
});

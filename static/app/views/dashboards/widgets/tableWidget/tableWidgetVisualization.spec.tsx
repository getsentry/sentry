import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TabularColumnsFixture} from 'sentry-fixture/tabularColumns';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import type {
  TabularColumn,
  TabularData,
  TabularRow,
} from 'sentry/views/dashboards/widgets/common/types';
import {sampleHTTPRequestTableData} from 'sentry/views/dashboards/widgets/tableWidget/fixtures/sampleHTTPRequestTableData';
import type {FieldRenderer} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';
import {TableWidgetVisualization} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';

describe('TableWidgetVisualization', function () {
  it('Basic table renders correctly', async function () {
    render(<TableWidgetVisualization tableData={sampleHTTPRequestTableData} />);

    expect(await screen.findByText('http.request_method')).toBeInTheDocument();
    expect(await screen.findByText('count(span.duration)')).toBeInTheDocument();
    expect(await screen.findByText('PATCH')).toBeInTheDocument();
    expect(await screen.findByText('14k')).toBeInTheDocument();
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

    const $headers = screen.getAllByRole('columnheader');
    expect($headers[0]).toHaveTextContent(columns[0]!.name!);
    expect($headers[1]).toHaveTextContent(columns[1]!.name!);
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

  it('Uses custom renderer over fallback renderer', async function () {
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
});

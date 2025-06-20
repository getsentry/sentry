import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import type {TabularData} from 'sentry/views/dashboards/widgets/common/types';
import {sampleHTTPRequestTableData} from 'sentry/views/dashboards/widgets/tableWidget/fixtures/sampleTableData';
import {TabularColumnFixture} from 'sentry/views/dashboards/widgets/tableWidget/fixtures/tabularColumn';
import {TableWidgetVisualization} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';

describe('tableWidgetVisualization', function () {
  it('Basic table renders correctly', async function () {
    render(<TableWidgetVisualization tableData={sampleHTTPRequestTableData} />);

    expect(await screen.findByText('http.request_method')).toBeInTheDocument();
    expect(await screen.findByText('count(span.duration)')).toBeInTheDocument();
  });

  it('Table applies columns prop and their custom names over fallback if provided', async function () {
    render(
      <TableWidgetVisualization
        tableData={sampleHTTPRequestTableData}
        columns={TabularColumnFixture()}
      />
    );

    expect(await screen.findByText('http request_method')).toBeInTheDocument();
    expect(await screen.findByText('count span.duration')).toBeInTheDocument();
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

  it('Table renders dates correctly', async function () {
    const tableData: TabularData = {
      data: [{date: '2025-06-20T15:14:52+00:00'}],
      meta: {
        fields: {date: 'date'},
        units: {
          date: null,
        },
      },
    };
    render(<TableWidgetVisualization tableData={tableData} />);

    expect(await screen.findByText('date')).toBeInTheDocument();
    expect(await screen.findByText('Jun 20, 2025 3:14:52 PM UTC')).toBeInTheDocument();
  });
});

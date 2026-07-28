import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {DisplayType} from 'sentry/views/dashboards/types';
import WidgetCardChart from 'sentry/views/dashboards/widgetCard/chart';
import {WidgetLegendSelectionState} from 'sentry/views/dashboards/widgetLegendSelectionState';

describe('WidgetCardChart', () => {
  const organization = OrganizationFixture();

  function renderChart(tableResults: TableDataWithTitle[], columns: string[]) {
    const widget = WidgetFixture({
      displayType: DisplayType.CATEGORICAL_BAR,
      queries: [
        WidgetQueryFixture({
          columns,
          aggregates: ['count()'],
          fields: [...columns, 'count()'],
        }),
      ],
    });

    return render(
      <WidgetCardChart
        widget={widget}
        tableResults={tableResults}
        loading={false}
        selection={PageFiltersFixture()}
        widgetLegendState={
          new WidgetLegendSelectionState({
            location: LocationFixture(),
            dashboard: DashboardFixture([widget]),
            organization,
            navigate: jest.fn(),
          })
        }
      />,
      {organization}
    );
  }

  it('renders "No Data" when no row has a plottable value', () => {
    renderChart(
      [
        {
          title: '',
          data: [
            {id: '1', workflowName: 'A'},
            {id: '2', workflowName: 'B'},
          ],
          meta: {fields: {workflowName: 'string', 'count()': 'integer'}},
        },
      ],
      ['workflowName']
    );

    expect(screen.getByText('No data to plot')).toBeInTheDocument();
  });

  it('renders "No Data" when the widget has no X-axis column', () => {
    renderChart(
      [
        {
          title: '',
          data: [{id: '1', 'count()': 5}],
          meta: {fields: {'count()': 'integer'}},
        },
      ],
      []
    );

    expect(screen.getByText('No data to plot')).toBeInTheDocument();
  });
});

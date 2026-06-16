import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DisplayType} from 'sentry/views/dashboards/types';
import {WidgetLegendSelectionState} from 'sentry/views/dashboards/widgetLegendSelectionState';
import {sampleLatencyHeatMap} from 'sentry/views/dashboards/widgets/heatMapWidget/fixtures/sampleLatencyHeatMap';

import WidgetCardChart from './chart';

describe('WidgetCardChart heat map', () => {
  const organization = OrganizationFixture();
  const selection = PageFiltersFixture();
  const widget = WidgetFixture({displayType: DisplayType.HEATMAP});
  const widgetLegendState = new WidgetLegendSelectionState({
    location: LocationFixture(),
    dashboard: DashboardFixture([widget]),
    organization,
    navigate: jest.fn(),
  });

  function renderChart(
    props: Partial<React.ComponentProps<typeof WidgetCardChart>> = {}
  ) {
    return render(
      <WidgetCardChart
        widget={widget}
        selection={selection}
        widgetLegendState={widgetLegendState}
        loading={false}
        {...props}
      />,
      {organization}
    );
  }

  it('renders the heat map visualization when data is present', () => {
    renderChart({heatmapResults: sampleLatencyHeatMap});

    // Neither the loading nor the empty (warning icon) state is shown.
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders an empty state when the heat map has no values', () => {
    renderChart({heatmapResults: {...sampleLatencyHeatMap, values: []}});

    // The empty state renders a warning icon (role="img"), not a chart.
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('renders a loading state while fetching', () => {
    renderChart({loading: true, heatmapResults: undefined});

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(document.querySelector('canvas')).not.toBeInTheDocument();
  });
});

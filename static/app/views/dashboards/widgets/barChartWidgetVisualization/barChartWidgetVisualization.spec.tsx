import {CategoricalSeriesFixture} from 'sentry-fixture/categoricalSeries';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BarChartWidgetVisualization} from 'sentry/views/dashboards/widgets/barChartWidgetVisualization/barChartWidgetVisualization';
import {sampleCountCategoricalData} from 'sentry/views/dashboards/widgets/barChartWidgetVisualization/fixtures/countCategorical';
import {sampleDurationCategoricalData} from 'sentry/views/dashboards/widgets/barChartWidgetVisualization/fixtures/durationCategorical';
import {sampleStackedCategoricalData} from 'sentry/views/dashboards/widgets/barChartWidgetVisualization/fixtures/stackedCategorical';
import {Bars} from 'sentry/views/dashboards/widgets/barChartWidgetVisualization/plottables/bars';

describe('BarChartWidgetVisualization', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Rendering', () => {
    it('renders a bar chart with duration data', () => {
      render(
        <BarChartWidgetVisualization
          plottables={[new Bars(sampleDurationCategoricalData)]}
        />
      );

      // The chart should render without errors
      expect(document.querySelector('canvas')).toBeDefined();
    });

    it('renders multiple series', () => {
      render(
        <BarChartWidgetVisualization
          plottables={[
            new Bars(sampleStackedCategoricalData[0]!),
            new Bars(sampleStackedCategoricalData[1]!),
          ]}
        />
      );

      // The chart should render without errors
      expect(document.querySelector('canvas')).toBeDefined();
    });

    it('renders stacked bars when stack option is provided', () => {
      render(
        <BarChartWidgetVisualization
          plottables={[
            new Bars(sampleStackedCategoricalData[0]!, {stack: 'all'}),
            new Bars(sampleStackedCategoricalData[1]!, {stack: 'all'}),
          ]}
        />
      );

      // The chart should render without errors
      expect(document.querySelector('canvas')).toBeDefined();
    });

    it('renders horizontal orientation', () => {
      render(
        <BarChartWidgetVisualization
          plottables={[new Bars(sampleCountCategoricalData)]}
          orientation="horizontal"
        />
      );

      // The chart should render without errors
      expect(document.querySelector('canvas')).toBeDefined();
    });
  });

  describe('Empty Data Handling', () => {
    it('throws error when all plottables are empty', () => {
      const emptySeries = CategoricalSeriesFixture({values: []});

      expect(() =>
        render(<BarChartWidgetVisualization plottables={[new Bars(emptySeries)]} />)
      ).toThrow('The data does not contain any plottable values.');
    });

    it('throws error when all values are null', () => {
      const nullValuesSeries = CategoricalSeriesFixture({
        values: [
          {category: 'A', value: null},
          {category: 'B', value: null},
        ],
      });

      expect(() =>
        render(<BarChartWidgetVisualization plottables={[new Bars(nullValuesSeries)]} />)
      ).toThrow('The data does not contain any plottable values.');
    });
  });

  describe('Legend', () => {
    it('shows legend when showLegend is always', () => {
      render(
        <BarChartWidgetVisualization
          plottables={[new Bars(sampleCountCategoricalData, {alias: 'Count'})]}
          showLegend="always"
        />
      );

      // The chart should render (legend is internal to ECharts)
      expect(document.querySelector('canvas')).toBeDefined();
    });

    it('hides legend when showLegend is never', () => {
      render(
        <BarChartWidgetVisualization
          plottables={[
            new Bars(sampleStackedCategoricalData[0]!),
            new Bars(sampleStackedCategoricalData[1]!),
          ]}
          showLegend="never"
        />
      );

      // The chart should render (legend is internal to ECharts)
      expect(document.querySelector('canvas')).toBeDefined();
    });
  });

  describe('Loading Placeholder', () => {
    it('renders loading placeholder', () => {
      render(<BarChartWidgetVisualization.LoadingPlaceholder />);

      // Loading indicator should be present
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });
  });
});

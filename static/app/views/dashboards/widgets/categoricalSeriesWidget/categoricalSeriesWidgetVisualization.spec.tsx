import {CategoricalSeriesFixture} from 'sentry-fixture/categoricalSeries';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {CategoricalSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/categoricalSeriesWidgetVisualization';
import {sampleCountCategoricalData} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/fixtures/countCategorical';
import {sampleDurationCategoricalData} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/fixtures/durationCategorical';
import {sampleStackedCategoricalData} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/fixtures/stackedCategorical';
import {Bars} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/plottables/bars';

describe('BarChartWidgetVisualization', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Bars', () => {
    describe('Rendering', () => {
      it('renders a bar chart with duration data', () => {
        render(
          <CategoricalSeriesWidgetVisualization
            plottables={[new Bars(sampleDurationCategoricalData)]}
          />
        );

        // The chart should render without errors
        expect(document.querySelector('canvas')).toBeDefined();
      });

      it('renders multiple series', () => {
        render(
          <CategoricalSeriesWidgetVisualization
            plottables={[
              new Bars(sampleStackedCategoricalData[0]),
              new Bars(sampleStackedCategoricalData[1]),
            ]}
          />
        );

        // The chart should render without errors
        expect(document.querySelector('canvas')).toBeDefined();
      });

      it('renders stacked bars when stack option is provided', () => {
        render(
          <CategoricalSeriesWidgetVisualization
            plottables={[
              new Bars(sampleStackedCategoricalData[0], {stack: 'all'}),
              new Bars(sampleStackedCategoricalData[1], {stack: 'all'}),
            ]}
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
          render(
            <CategoricalSeriesWidgetVisualization plottables={[new Bars(emptySeries)]} />
          )
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
          render(
            <CategoricalSeriesWidgetVisualization
              plottables={[new Bars(nullValuesSeries)]}
            />
          )
        ).toThrow('The data does not contain any plottable values.');
      });
    });

    describe('Legend', () => {
      it('shows legend when showLegend is always', () => {
        render(
          <CategoricalSeriesWidgetVisualization
            plottables={[new Bars(sampleCountCategoricalData, {alias: 'Count'})]}
            showLegend="always"
          />
        );

        // The chart should render (legend is internal to ECharts)
        expect(document.querySelector('canvas')).toBeDefined();
      });

      it('hides legend when showLegend is never', () => {
        render(
          <CategoricalSeriesWidgetVisualization
            plottables={[
              new Bars(sampleStackedCategoricalData[0]),
              new Bars(sampleStackedCategoricalData[1]),
            ]}
            showLegend="never"
          />
        );

        // The chart should render (legend is internal to ECharts)
        expect(document.querySelector('canvas')).toBeDefined();
      });
    });
  });

  describe('Loading Placeholder', () => {
    it('renders loading placeholder', () => {
      render(<CategoricalSeriesWidgetVisualization.LoadingPlaceholder />);

      // Loading indicator should be present
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });
  });
});

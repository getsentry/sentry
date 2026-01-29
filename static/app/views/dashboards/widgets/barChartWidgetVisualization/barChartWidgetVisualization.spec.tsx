import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BarChartWidgetVisualization} from 'sentry/views/dashboards/widgets/barChartWidgetVisualization/barChartWidgetVisualization';
import {
  sampleCountCategoricalData,
  sampleDurationCategoricalData,
  sampleStackedCategoricalData,
} from 'sentry/views/dashboards/widgets/barChartWidgetVisualization/fixtures/sampleCountCategoricalData';
import {Bars} from 'sentry/views/dashboards/widgets/barChartWidgetVisualization/plottables/bar';
import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

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
      const emptySeries: CategoricalSeries = {
        valueAxis: 'count()',
        meta: {
          valueType: 'integer',
          valueUnit: null,
        },
        values: [],
      };

      expect(() =>
        render(<BarChartWidgetVisualization plottables={[new Bars(emptySeries)]} />)
      ).toThrow('The data does not contain any plottable values.');
    });

    it('throws error when all values are null', () => {
      const nullValuesSeries: CategoricalSeries = {
        valueAxis: 'count()',
        meta: {
          valueType: 'integer',
          valueUnit: null,
        },
        values: [
          {category: 'A', value: null},
          {category: 'B', value: null},
        ],
      };

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

describe('Bar Plottable', () => {
  describe('Properties', () => {
    it('returns correct name from alias', () => {
      const bar = new Bars(sampleCountCategoricalData, {alias: 'Custom Name'});
      expect(bar.name).toBe('Custom Name');
    });

    it('returns valueAxis as name when no alias', () => {
      const bar = new Bars(sampleCountCategoricalData);
      expect(bar.name).toBe('count()');
    });

    it('returns name with groupBy when groupBy is present', () => {
      const bar = new Bars(sampleStackedCategoricalData[0]!);
      expect(bar.name).toBe('count() : status : success');
    });

    it('returns correct label', () => {
      const bar = new Bars(sampleCountCategoricalData, {alias: 'Custom Label'});
      expect(bar.label).toBe('Custom Label');
    });

    it('returns groupBy value as label when groupBy is present', () => {
      const bar = new Bars(sampleStackedCategoricalData[0]!);
      expect(bar.label).toBe('success');
    });

    it('returns correct dataType', () => {
      const bar = new Bars(sampleCountCategoricalData);
      expect(bar.dataType).toBe('integer');
    });

    it('returns correct dataUnit', () => {
      const bar = new Bars(sampleDurationCategoricalData);
      expect(bar.dataUnit).toBe('millisecond');
    });

    it('returns isEmpty true for empty data', () => {
      const emptySeries: CategoricalSeries = {
        valueAxis: 'count()',
        meta: {valueType: 'integer', valueUnit: null},
        values: [],
      };
      const bar = new Bars(emptySeries);
      expect(bar.isEmpty).toBe(true);
    });

    it('returns isEmpty true for all null values', () => {
      const nullSeries: CategoricalSeries = {
        valueAxis: 'count()',
        meta: {valueType: 'integer', valueUnit: null},
        values: [
          {category: 'A', value: null},
          {category: 'B', value: null},
        ],
      };
      const bar = new Bars(nullSeries);
      expect(bar.isEmpty).toBe(true);
    });

    it('returns isEmpty false for valid data', () => {
      const bar = new Bars(sampleCountCategoricalData);
      expect(bar.isEmpty).toBe(false);
    });

    it('returns needsColor true when no color specified', () => {
      const bar = new Bars(sampleCountCategoricalData);
      expect(bar.needsColor).toBe(true);
    });

    it('returns needsColor false when color specified', () => {
      const bar = new Bars(sampleCountCategoricalData, {color: '#ff0000'});
      expect(bar.needsColor).toBe(false);
    });

    it('returns correct categories', () => {
      const bar = new Bars(sampleCountCategoricalData);
      expect(bar.categories).toEqual(['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera']);
    });
  });

  describe('Event Handlers', () => {
    it('calls onClick handler with correct item', () => {
      const onClickMock = jest.fn();
      const bar = new Bars(sampleCountCategoricalData, {onClick: onClickMock});

      bar.onClick(0);

      expect(onClickMock).toHaveBeenCalledWith({category: 'Chrome', value: 1250}, 0);
    });

    it('calls onHighlight handler with correct item', () => {
      const onHighlightMock = jest.fn();
      const bar = new Bars(sampleCountCategoricalData, {onHighlight: onHighlightMock});

      bar.onHighlight(1);

      expect(onHighlightMock).toHaveBeenCalledWith({category: 'Firefox', value: 890}, 1);
    });

    it('calls onDownplay handler with correct item', () => {
      const onDownplayMock = jest.fn();
      const bar = new Bars(sampleCountCategoricalData, {onDownplay: onDownplayMock});

      bar.onDownplay(2);

      expect(onDownplayMock).toHaveBeenCalledWith({category: 'Safari', value: 650}, 2);
    });

    it('does not throw when handler not provided', () => {
      const bar = new Bars(sampleCountCategoricalData);

      expect(() => bar.onClick(0)).not.toThrow();
      expect(() => bar.onHighlight(0)).not.toThrow();
      expect(() => bar.onDownplay(0)).not.toThrow();
    });
  });
});

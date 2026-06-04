import {CategoricalSeriesFixture} from 'sentry-fixture/categoricalSeries';

import {sampleCountCategoricalData} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/fixtures/countCategorical';
import {sampleDurationCategoricalData} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/fixtures/durationCategorical';
import {sampleStackedCategoricalData} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/fixtures/stackedCategorical';
import {Bars} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/plottables/bars';

describe('Bars', () => {
  describe('Properties', () => {
    it('returns canonical name even when alias is provided', () => {
      const bar = new Bars(sampleCountCategoricalData, {alias: 'Custom Name'});
      // name is always the canonical identifier for ECharts, not the alias
      expect(bar.name).toBe('count()');
    });

    it('returns valueAxis as name when no alias', () => {
      const bar = new Bars(sampleCountCategoricalData);
      expect(bar.name).toBe('count()');
    });

    it('returns name with groupBy when groupBy is present', () => {
      const bar = new Bars(sampleStackedCategoricalData[0]);
      expect(bar.name).toBe('count() : status : success');
    });

    it('returns correct label', () => {
      const bar = new Bars(sampleCountCategoricalData, {alias: 'Custom Label'});
      expect(bar.label).toBe('Custom Label');
    });

    it('returns groupBy value as label when groupBy is present', () => {
      const bar = new Bars(sampleStackedCategoricalData[0]);
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
      const emptySeries = CategoricalSeriesFixture({values: []});
      const bar = new Bars(emptySeries);
      expect(bar.isEmpty).toBe(true);
    });

    it('returns isEmpty true for all null values', () => {
      const nullSeries = CategoricalSeriesFixture({
        values: [
          {category: 'A', value: null},
          {category: 'B', value: null},
        ],
      });
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

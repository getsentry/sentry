import {HeatMapSeriesFixture} from 'sentry-fixture/heatMapSeries';

import {DisplayType} from 'sentry/views/dashboards/types';

import {getWidgetDataState} from './widgetCardChartContainer';

describe('getWidgetDataState', () => {
  it('distinguishes empty table results from errors', () => {
    expect(
      getWidgetDataState(undefined, undefined, [], undefined, DisplayType.TABLE, false)
    ).toEqual({type: 'empty'});
    expect(
      getWidgetDataState(
        'No data found',
        undefined,
        [],
        undefined,
        DisplayType.TABLE,
        false
      )
    ).toEqual({type: 'error', message: 'No data found'});
  });

  it('does not treat missing results as empty while loading', () => {
    expect(
      getWidgetDataState(
        undefined,
        undefined,
        undefined,
        undefined,
        DisplayType.TABLE,
        true
      )
    ).toBeUndefined();
  });

  it('does not treat a zero-valued aggregate row as empty', () => {
    expect(
      getWidgetDataState(
        undefined,
        undefined,
        [{title: '', data: [{id: 'row', count: 0}]}],
        undefined,
        DisplayType.BIG_NUMBER,
        false
      )
    ).toBeUndefined();
  });

  it('checks heatmap values for empty data', () => {
    expect(
      getWidgetDataState(
        undefined,
        undefined,
        undefined,
        HeatMapSeriesFixture({values: []}),
        DisplayType.HEATMAP,
        false
      )
    ).toEqual({type: 'empty'});
  });

  it('lets self-fetching widgets manage their own data state', () => {
    expect(
      getWidgetDataState(
        undefined,
        undefined,
        undefined,
        undefined,
        DisplayType.AGENTS_TRACES_TABLE,
        false
      )
    ).toBeUndefined();
  });
});

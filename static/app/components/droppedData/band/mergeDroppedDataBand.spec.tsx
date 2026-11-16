import type {ECharts} from 'echarts';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {DroppedDataProps} from 'sentry/components/droppedData/types';
import type {EChartClickHandler, ReactEchartsRef} from 'sentry/types/echarts';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

import {mergeDroppedDataBand} from './mergeDroppedDataBand';
import {
  BAND_HEIGHT,
  DROPPED_DATA_SERIES_ID,
  useDroppedDataBand,
} from './useDroppedDataBand';

type ClickEvent = Parameters<EChartClickHandler>[0];

const chartRef: React.RefObject<ReactEchartsRef | null> = {current: null};
const instance = {} as ECharts;

function renderBand(droppedData?: DroppedDataProps) {
  const {result} = renderHookWithProviders(() =>
    useDroppedDataBand({chartRef, droppedData})
  );
  return result.current;
}

const visibleBand = () =>
  renderBand({
    dataset: DiscoverDatasets.SPANS,
    droppedEvents: [OutcomeRowFixture({count: 10})],
  });

describe('mergeDroppedDataBand', () => {
  it('returns the options unchanged without a band', () => {
    const options = {grid: {bottom: 12}, yAxes: [{type: 'value' as const}]};

    expect(mergeDroppedDataBand(options, renderBand())).toBe(options);
  });

  it('appends the band series on the next y-axis', () => {
    const band = visibleBand();
    const series = [{type: 'line' as const, name: 'count()'}];
    const yAxes = [{type: 'value' as const}, {type: 'value' as const}];

    const merged = mergeDroppedDataBand({grid: {bottom: 12}, series, yAxes}, band);

    expect(merged.yAxes).toEqual([...yAxes, band.droppedDataYAxis]);
    expect(merged.series).toEqual([
      ...series,
      expect.objectContaining({id: DROPPED_DATA_SERIES_ID, yAxisIndex: 2}),
    ]);
  });

  it('adds the band height under other bands', () => {
    const merged = mergeDroppedDataBand(
      {
        grid: {left: 2, bottom: 20},
        xAxis: {type: 'value', offset: 18, axisLine: {onZero: true, show: true}},
        yAxes: [],
      },
      visibleBand()
    );

    expect(merged.grid).toEqual({left: 2, bottom: 20 + BAND_HEIGHT});
    expect(merged.xAxis).toEqual({
      type: 'value',
      offset: 18 + BAND_HEIGHT,
      axisLine: {onZero: false, show: true},
    });
  });

  it('moves the x-axis below the band without a base x-axis', () => {
    const merged = mergeDroppedDataBand({grid: {bottom: 0}, yAxes: []}, visibleBand());

    expect(merged.xAxis).toEqual({offset: BAND_HEIGHT, axisLine: {onZero: false}});
  });

  it('sends band clicks to the band and other clicks to the chart', () => {
    const onBandClick = jest.fn();
    const onClick = jest.fn();
    const merged = mergeDroppedDataBand(
      {grid: {bottom: 0}, yAxes: [], onClick},
      visibleBand(),
      onBandClick
    );

    merged.onClick?.({seriesId: DROPPED_DATA_SERIES_ID} as ClickEvent, instance);

    expect(onBandClick).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();

    const seriesClick = {seriesId: 'count()'} as ClickEvent;
    merged.onClick?.(seriesClick, instance);

    expect(onBandClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(seriesClick, instance);
  });
});

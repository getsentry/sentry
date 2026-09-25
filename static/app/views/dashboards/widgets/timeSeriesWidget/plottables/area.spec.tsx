import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {Area} from './area';

// The global ECharts module mapper is a stub. Load the bundled renderer only
// here so this regression exercises real stacking without changing other tests.
const {init} = jest.requireActual<typeof import('echarts')>(
  `${process.cwd()}/node_modules/echarts/dist/echarts.js`
);

describe('Area', () => {
  const timeSeries = TimeSeriesFixture({
    values: [
      {timestamp: 1729796400000, value: 10},
      {timestamp: 1729798200000, value: 20, incomplete: true},
    ],
  });

  it.each(['left', 'right'] as const)(
    'stacks matching segments on the %s axis while keeping complete and incomplete data separate',
    yAxisPosition => {
      const plottingOptions = {
        color: '#7553FF',
        unit: timeSeries.meta.valueUnit,
        yAxisPosition,
      };
      const first = new Area(timeSeries).toSeries(plottingOptions);
      const second = new Area(
        TimeSeriesFixture({...timeSeries, yAxis: 'other()'})
      ).toSeries(plottingOptions);

      expect(first).toHaveLength(2);
      expect(second).toHaveLength(2);
      expect(first[0]!.stack).toBeTruthy();
      expect(first[1]!.stack).toBeTruthy();
      expect(first[0]!.stack).toBe(second[0]!.stack);
      expect(first[1]!.stack).toBe(second[1]!.stack);
      expect(first[0]!.stack).not.toBe(first[1]!.stack);
    }
  );

  it.each(['left', 'right'] as const)(
    'adds flavor sales on the %s axis without including the other axis, including legend toggles',
    yAxisPosition => {
      const flavors = [
        {name: 'Strawberry', values: [12, 20, 10]},
        {name: 'Chocolate', values: [8, 5, 4]},
        {name: 'Vanilla', values: [15, 7, 6]},
        {name: 'Other shop', values: [100, 200, 300]},
      ];
      const series = flavors.flatMap(({name, values}, index) => {
        const data = TimeSeriesFixture({
          yAxis: 'sum(scoops)',
          meta: {valueType: 'integer', valueUnit: null, interval: 1_800_000},
          values: values.map((value, pointIndex) => ({
            timestamp: 1729796400000 + pointIndex * 1_800_000,
            value,
            incomplete: pointIndex === 2,
          })),
        });
        return new Area(data, {name}).toSeries({
          color: '#7553FF',
          unit: null,
          yAxisPosition:
            index === 3 ? (yAxisPosition === 'left' ? 'right' : 'left') : yAxisPosition,
        });
      });
      const chart = init(null, undefined, {
        renderer: 'svg',
        ssr: true,
        width: 600,
        height: 300,
      });

      // Check ECharts' calculated boundaries, not a test-side sum of the input.
      const expectBoundary = (index: number, expected: number[]) => {
        // Bracket access is needed for ECharts' private, typed model accessor.
        // eslint-disable-next-line @typescript-eslint/dot-notation
        const data = chart['getModel']().getSeriesByIndex(index).getData();
        const dimension = data.getCalculationInfo('stackResultDimension');
        expect(data.count()).toBe(expected.length);
        expect(expected.map((_, pointIndex) => data.get(dimension, pointIndex))).toEqual(
          expected
        );
      };
      const expectFlavorStack = () => {
        expectBoundary(0, [12, 20]);
        expectBoundary(1, [20, 10]);
        expectBoundary(2, [20, 25]);
        expectBoundary(3, [25, 14]);
        expectBoundary(4, [35, 32]);
        expectBoundary(5, [32, 20]);
      };

      try {
        chart.setOption({
          animation: false,
          legend: {},
          xAxis: {type: 'time'},
          yAxis: (['left', 'right'] as const).map(position => ({
            type: 'value',
            position,
            min: 0,
            max: position === yAxisPosition ? 60 : 400,
          })),
          series,
        });
        expectFlavorStack();
        expectBoundary(6, [100, 200]);
        expectBoundary(7, [200, 300]);

        chart.dispatchAction({type: 'legendUnSelect', name: 'Other shop'});
        expectFlavorStack();
        chart.dispatchAction({type: 'legendSelect', name: 'Other shop'});
        expectFlavorStack();
        expectBoundary(6, [100, 200]);
        expectBoundary(7, [200, 300]);

        chart.dispatchAction({type: 'legendUnSelect', name: 'Chocolate'});
        expectBoundary(4, [27, 27]);
        expectBoundary(5, [27, 16]);
        expectBoundary(6, [100, 200]);
        expectBoundary(7, [200, 300]);
        chart.dispatchAction({type: 'legendSelect', name: 'Chocolate'});
        expectFlavorStack();
      } finally {
        chart.dispose();
      }
    }
  );

  it('does not stack complete or incomplete data across Y axes', () => {
    const area = new Area(timeSeries);
    const plottingOptions = {color: '#7553FF', unit: timeSeries.meta.valueUnit};
    const left = area.toSeries({...plottingOptions, yAxisPosition: 'left'});
    const right = area.toSeries({...plottingOptions, yAxisPosition: 'right'});

    expect(left).toHaveLength(2);
    expect(right).toHaveLength(2);
    expect(left.map(series => series.yAxisIndex)).toEqual([0, 0]);
    expect(right.map(series => series.yAxisIndex)).toEqual([1, 1]);
    expect(left[0]!.stack).not.toBe(right[0]!.stack);
    expect(left[1]!.stack).not.toBe(right[1]!.stack);
  });
});

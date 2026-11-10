import {ThemeFixture} from 'sentry-fixture/theme';

import {AnomalyMarkers, makeAnomalyTooltipDetails} from './anomalyMarkers';

const theme = ThemeFixture();

const periods = [
  {start: 1000, end: 3000, priority: 'high' as const},
  {start: 5000, end: 6000, priority: 'medium' as const},
];

describe('AnomalyMarkers', () => {
  it('draws a bar, a start line and faint shading for each period', () => {
    const markers = new AnomalyMarkers({dataType: 'number', dataUnit: null, periods});

    expect(markers.isEmpty).toBe(false);
    expect(markers.start).toBe(1000);
    expect(markers.end).toBe(6000);

    const series = markers.toSeries({theme}) as any[];
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({
      type: 'custom',
      name: '__anomalies__',
      silent: true,
    });
    // Plain objects without a `value`, so the bars don't stretch either axis
    expect(series[0].data).toEqual(periods);

    expect(series[0].markLine.data).toEqual([
      expect.objectContaining({
        xAxis: 1000,
        lineStyle: expect.objectContaining({color: theme.colors.red400}),
      }),
      expect.objectContaining({
        xAxis: 5000,
        lineStyle: expect.objectContaining({color: theme.colors.yellow400}),
      }),
    ]);
    expect(series[0].markArea.data).toEqual([
      [
        {xAxis: 1000, itemStyle: {color: theme.colors.red400, opacity: 0.08}},
        {xAxis: 3000},
      ],
      [
        {xAxis: 5000, itemStyle: {color: theme.colors.yellow400, opacity: 0.08}},
        {xAxis: 6000},
      ],
    ]);
  });

  it('pins each bar to the bottom of the plot area, clipped to its edges', () => {
    const markers = new AnomalyMarkers({dataType: 'number', dataUnit: null, periods});
    const [series] = markers.toSeries({theme}) as any[];
    // 1px per ms, plot area from x=1500 to x=10000, y=0 to y=100
    const api = {coord: ([x]: [number, number]) => [x, 100]};
    const params = {dataIndex: 0, coordSys: {x: 1500, y: 0, width: 8500, height: 100}};

    expect(series.renderItem(params, api)).toMatchObject({
      type: 'rect',
      shape: {x: 1500, y: 94, width: 1500, height: 6},
      style: {fill: theme.colors.red400},
    });
  });

  it('draws nothing without periods', () => {
    const markers = new AnomalyMarkers({dataType: 'number', dataUnit: null, periods: []});

    expect(markers.isEmpty).toBe(true);
    expect(markers.start).toBeNull();
    expect(markers.toSeries({theme})).toEqual([]);
  });
});

describe('makeAnomalyTooltipDetails', () => {
  const renderDetails = makeAnomalyTooltipDetails({
    anomalousTimestamps: new Set([1000, 2000, 3000, 5000]),
    periods,
    theme,
    utc: true,
  })!;

  it('shows when the anomaly started and ended for a flagged bucket', () => {
    const html = renderDetails([], 2000);

    expect(html).toContain('Anomaly (high confidence)');
    expect(html).toContain('Started');
    expect(html).toContain('Ended');
  });

  it('labels low confidence anomalies', () => {
    expect(renderDetails([], 5000)).toContain('Anomaly (low confidence)');
  });

  it('adds nothing for buckets Seer did not flag', () => {
    // 6000 is inside the second period's shading but wasn't flagged itself
    expect(renderDetails([], 6000)).toBe('');
    expect(renderDetails([], 4000)).toBe('');
  });

  it('returns no renderer without periods', () => {
    expect(
      makeAnomalyTooltipDetails({
        anomalousTimestamps: new Set(),
        periods: [],
        theme,
        utc: true,
      })
    ).toBeUndefined();
  });
});

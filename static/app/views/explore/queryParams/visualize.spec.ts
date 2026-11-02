import {
  parseAsBaseVisualizeList,
  parseVisualize,
  Visualize,
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chart';

describe('VisualizeFunction', () => {
  it('clears transformations explicitly and keeps legacy serialization unchanged', () => {
    const visualize = new VisualizeFunction('count(span.duration)', {
      transformations: ['fill(zero)'],
    });
    expect(visualize.replace({transformations: []}).serialize()).toEqual({
      yAxes: ['count(span.duration)'],
    });
    expect(new VisualizeFunction('count(span.duration)').serialize()).toEqual({
      yAxes: ['count(span.duration)'],
    });
  });

  it.each([null, 'fill(locf)', [123], {}])(
    'ignores malformed transformation state %s without losing the series',
    transformations => {
      const [visualize] = parseVisualize({
        yAxes: ['avg(span.duration)'],
        transformations,
      });
      expect(visualize?.serialize()).toEqual({yAxes: ['avg(span.duration)']});
    }
  );

  it('keeps transformations on equations', () => {
    const [visualize] = parseVisualize({
      yAxes: ['equation|count(span.duration) * 2'],
      transformations: ['fill(locf)'],
    });
    expect(visualize).toBeInstanceOf(VisualizeEquation);
    expect(visualize?.serialize()).toEqual({
      yAxes: ['equation|count(span.duration) * 2'],
      transformations: ['fill(locf)'],
    });
    expect(
      visualize?.replace({yAxis: 'equation|count(span.duration) * 3'}).clone().serialize()
    ).toEqual({
      yAxes: ['equation|count(span.duration) * 3'],
      transformations: ['fill(locf)'],
    });
    expect(visualize?.replace({transformations: []}).serialize()).toEqual({
      yAxes: ['equation|count(span.duration) * 2'],
    });
  });

  it.each(['count(span.duration)', 'count_unique(span.op)', 'sum(span.duration)'])(
    'defaults to bar charts for %s',
    yAxis => {
      const visualize = new VisualizeFunction(yAxis);
      expect(visualize.chartType).toEqual(ChartType.BAR);
    }
  );

  it.each([
    'avg(span.duration)',
    'p50(span.duration)',
    'p75(span.duration)',
    'p90(span.duration)',
    'p95(span.duration)',
    'p99(span.duration)',
    'p100(span.duration)',
    'min(span.duration)',
    'max(span.duration)',
  ])('defaults to bar charts for %s', yAxis => {
    const visualize = new VisualizeFunction(yAxis);
    expect(visualize.chartType).toEqual(ChartType.LINE);
  });

  it('uses selected chart type', () => {
    const visualize = new VisualizeFunction('count(span.duration)', {
      chartType: ChartType.AREA,
    });
    expect(visualize.chartType).toEqual(ChartType.AREA);
  });

  it('uses line charts while in a chart group', () => {
    const grouped = new VisualizeFunction('count(span.duration)', {
      chartType: ChartType.BAR,
      chartGroup: 'chart-group',
    });
    expect(grouped.chartType).toEqual(ChartType.LINE);

    // The selected chart type comes back once the visualize leaves the group.
    const ungrouped = grouped.replace({chartGroup: null});
    expect(ungrouped.chartType).toEqual(ChartType.BAR);
  });

  it('clones', () => {
    const vis1 = new VisualizeFunction('count(span.duration)', {
      chartType: ChartType.AREA,
      transformations: ['fill(locf)', 'smooth(sma,5)'],
      visible: false,
    });
    const vis2 = vis1.clone();
    expect(vis2.serialize()).toEqual({
      yAxes: ['count(span.duration)'],
      chartType: ChartType.AREA,
      transformations: ['fill(locf)', 'smooth(sma,5)'],
      visible: false,
    });
  });

  it('replaces yAxes', () => {
    const vis1 = new VisualizeFunction('count(span.duration)', {
      chartType: ChartType.AREA,
    });
    const vis2 = vis1.replace({yAxis: 'avg(span.duration)'});
    expect(vis2).toEqual(
      new VisualizeFunction('avg(span.duration)', {chartType: ChartType.AREA})
    );
  });

  it('replaces chart type', () => {
    const vis1 = new VisualizeFunction('count(span.duration)', {
      chartType: ChartType.AREA,
      transformations: ['fill(locf)', 'smooth(sma,5)'],
    });
    const vis2 = vis1.replace({chartType: ChartType.LINE});
    expect(vis2.serialize()).toEqual({
      yAxes: ['count(span.duration)'],
      chartType: ChartType.LINE,
      transformations: ['fill(locf)', 'smooth(sma,5)'],
    });
  });

  it('replaces visible', () => {
    const vis1 = new VisualizeFunction('count(span.duration)', {
      visible: false,
    });
    const vis2 = vis1.replace({visible: true});
    expect(vis2).toEqual(new VisualizeFunction('count(span.duration)', {visible: true}));
  });

  it('replaces yAxes and chart type', () => {
    const vis1 = new VisualizeFunction('count(span.duration)', {
      chartType: ChartType.AREA,
      visible: true,
    });
    const vis2 = vis1.replace({
      yAxis: 'avg(span.duration)',
      chartType: ChartType.LINE,
      visible: false,
    });
    expect(vis2).toEqual(
      new VisualizeFunction('avg(span.duration)', {
        chartType: ChartType.LINE,
        visible: false,
      })
    );
  });

  it('converts from JSON without chart type', () => {
    const visualize = Visualize.fromJSON({
      yAxes: ['count(span.duration)'],
    });
    expect(visualize).toEqual([new VisualizeFunction('count(span.duration)')]);
  });

  it('converts from JSON with chart type', () => {
    const visualize = Visualize.fromJSON({
      yAxes: ['count(span.duration)'],
      chartType: ChartType.AREA,
    });
    expect(visualize).toEqual([
      new VisualizeFunction('count(span.duration)', {chartType: ChartType.AREA}),
    ]);
  });
});

describe('parseVisualize', () => {
  it.each([
    null,
    'count(span.duration)',
    [],
    {},
    {yAxes: 'count(span.duration)'},
    {yAxes: [1]},
  ])('rejects %j', value => {
    expect(parseVisualize(value)).toEqual([]);
  });

  it.each(['LINE', '1', 99, null])(
    'uses the default chart type when the chart type is %j',
    chartType => {
      const visualizes = parseVisualize({yAxes: ['avg(span.duration)'], chartType});
      expect(visualizes).toEqual([new VisualizeFunction('avg(span.duration)')]);
    }
  );

  it.each([null, 'false', 0, ''])(
    'keeps the series visible when visible is %j',
    visible => {
      const visualizes = parseVisualize({yAxes: ['avg(span.duration)'], visible});
      expect(visualizes).toEqual([new VisualizeFunction('avg(span.duration)')]);
    }
  );

  it.each([null, 123, ['equation|count(span.duration)']])(
    'ignores a malformed internal expression %j',
    internalExpression => {
      const visualizes = parseVisualize({
        yAxes: ['equation|count(span.duration)'],
        internalExpression,
      });
      expect(visualizes).toEqual([
        new VisualizeEquation('equation|count(span.duration)'),
      ]);
    }
  );
});

describe('parseAsBaseVisualizeList', () => {
  it('round trips valid visualizes', () => {
    const raw = [
      JSON.stringify({yAxes: ['count(span.duration)'], chartType: ChartType.BAR}),
      JSON.stringify({
        yAxes: ['equation|count(span.duration) * 2'],
        internalExpression: 'equation|count(span.duration) * 2',
        transformations: ['fill(locf)'],
        visible: false,
      }),
    ];
    const parsed = parseAsBaseVisualizeList.parse(raw);
    expect(parsed && parseAsBaseVisualizeList.serialize(parsed)).toEqual(raw);
  });

  it('skips entries that are not valid visualizes', () => {
    const parsed = parseAsBaseVisualizeList.parse([
      '{',
      'null',
      JSON.stringify({yAxes: [1]}),
      JSON.stringify({yAxes: ['count(span.duration)']}),
    ]);
    expect(parsed).toEqual([{yAxes: ['count(span.duration)']}]);
  });

  it('drops unknown keys', () => {
    const parsed = parseAsBaseVisualizeList.parse([
      JSON.stringify({yAxes: ['count(span.duration)'], unknown: true}),
    ]);
    expect(parsed).toEqual([{yAxes: ['count(span.duration)']}]);
  });
});

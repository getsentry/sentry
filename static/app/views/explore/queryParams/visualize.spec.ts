import {
  Visualize,
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chart';

describe('VisualizeFunction', () => {
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

  it('clones', () => {
    const vis1 = new VisualizeFunction('count(span.duration)', {
      chartType: ChartType.AREA,
      visible: false,
    });
    const vis2 = vis1.clone();
    expect(vis1).toEqual(vis2);
  });

  it('replaces yAxes', () => {
    const vis1 = new VisualizeFunction('count(span.duration)', {
      chartType: ChartType.AREA,
    });
    const vis2 = vis1.replace({yAxis: 'avg(span.duration)'});
    expect(vis2).toEqual(
      new VisualizeFunction('avg(span.duration)', {chartType: ChartType.AREA})
    );
    expect(vis2.yAxes).toEqual(['avg(span.duration)']);
  });

  it('replaces multiple yAxes', () => {
    const vis1 = new VisualizeFunction('count(span.duration)', {
      chartType: ChartType.AREA,
    });
    const vis2 = vis1.replace({yAxes: ['avg(span.duration)', 'p95(span.duration)']});
    expect(vis2).toEqual(
      new VisualizeFunction(['avg(span.duration)', 'p95(span.duration)'], {
        chartType: ChartType.AREA,
      })
    );
    expect(vis2.yAxis).toBe('avg(span.duration)');
  });

  it('replaces chart type', () => {
    const vis1 = new VisualizeFunction('count(span.duration)', {
      chartType: ChartType.AREA,
    });
    const vis2 = vis1.replace({chartType: ChartType.LINE});
    expect(vis2).toEqual(
      new VisualizeFunction('count(span.duration)', {chartType: ChartType.LINE})
    );
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

  it('converts multiple yAxes from JSON into one visualize', () => {
    const visualize = Visualize.fromJSON({
      yAxes: ['avg(span.duration)', 'p95(span.duration)'],
      chartType: ChartType.LINE,
    });
    expect(visualize).toEqual([
      new VisualizeFunction(['avg(span.duration)', 'p95(span.duration)'], {
        chartType: ChartType.LINE,
      }),
    ]);
    expect(visualize[0]!.yAxis).toBe('avg(span.duration)');
    expect(visualize[0]!.yAxes).toEqual(['avg(span.duration)', 'p95(span.duration)']);
  });

  it('serializes all yAxes', () => {
    const visualize = new VisualizeFunction(
      ['avg(span.duration)', 'p95(span.duration)'],
      {
        chartType: ChartType.LINE,
        visible: false,
      }
    );
    expect(visualize.serialize()).toEqual({
      yAxes: ['avg(span.duration)', 'p95(span.duration)'],
      chartType: ChartType.LINE,
      visible: false,
    });
  });

  it('exposes parsedFunctions and parsedFunction', () => {
    const visualize = new VisualizeFunction(['avg(span.duration)', 'p95(span.duration)']);
    expect(visualize.parsedFunction?.name).toBe('avg');
    expect(visualize.parsedFunctions.map(func => func?.name)).toEqual(['avg', 'p95']);
  });

  it('clones multiple yAxes', () => {
    const vis1 = new VisualizeFunction(['avg(span.duration)', 'p95(span.duration)'], {
      chartType: ChartType.LINE,
      visible: false,
    });
    const vis2 = vis1.clone();
    expect(vis1).toEqual(vis2);
    expect(vis2.yAxes).toEqual(['avg(span.duration)', 'p95(span.duration)']);
  });

  it('splits equation and function visualizes from JSON', () => {
    const visualize = Visualize.fromJSON({
      yAxes: ['equation|a+b', 'avg(span.duration)'],
      chartType: ChartType.LINE,
    });
    expect(visualize).toEqual([
      new VisualizeEquation('equation|a+b', {chartType: ChartType.LINE}),
      new VisualizeFunction('avg(span.duration)', {chartType: ChartType.LINE}),
    ]);
  });
});

describe('VisualizeEquation', () => {
  it('clones and preserves visible', () => {
    const vis1 = new VisualizeEquation('equation|a+b', {
      chartType: ChartType.LINE,
      visible: false,
    });
    const vis2 = vis1.clone();
    expect(vis2).toEqual(
      new VisualizeEquation('equation|a+b', {
        chartType: ChartType.LINE,
        visible: false,
      })
    );
    expect(vis2.visible).toBe(false);
  });
});

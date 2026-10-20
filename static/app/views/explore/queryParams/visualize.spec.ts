import {
  parseVisualize,
  Visualize,
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chart';

describe('VisualizeFunction', () => {
  it('copies transformation arrays at construction, clone and serialization', () => {
    const transformations = ['fill(locf)'];
    const visualize = new VisualizeFunction('avg(span.duration)', {transformations});
    const clone = visualize.clone();
    transformations.push('smooth(sma,5)');
    expect(visualize.transformations).toEqual(['fill(locf)']);
    expect(clone.transformations).toEqual(['fill(locf)']);
    expect(clone.transformations).not.toBe(visualize.transformations);
    expect(visualize.serialize().transformations).not.toBe(visualize.transformations);
  });

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

  it('does not apply transformations to equations', () => {
    const [visualize] = parseVisualize({
      yAxes: ['equation|count(span.duration) * 2'],
      transformations: ['fill(locf)'],
    });
    expect(visualize?.serialize()).toEqual({
      yAxes: ['equation|count(span.duration) * 2'],
    });
    expect(visualize).toBeInstanceOf(VisualizeEquation);
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

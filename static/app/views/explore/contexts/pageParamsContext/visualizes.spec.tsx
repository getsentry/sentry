import {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {ChartType} from 'sentry/views/insights/common/components/chart';

describe('Visualize', function () {
  it.each(['count(span.duration)', 'count_unique(span.op)', 'sum(span.duration)'])(
    'defaults to bar charts for %s',
    function (yAxis) {
      const visualize = new Visualize(yAxis);
      expect(visualize.chartType).toEqual(ChartType.BAR);
      expect(visualize.stack).toBeDefined();
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
  ])('defaults to bar charts for %s', function (yAxis) {
    const visualize = new Visualize(yAxis);
    expect(visualize.chartType).toEqual(ChartType.LINE);
    expect(visualize.stack).toBeDefined();
  });

  it('uses selected chart type', function () {
    const visualize = new Visualize('count(span.duration)', {
      chartType: ChartType.AREA,
    });
    expect(visualize.chartType).toEqual(ChartType.AREA);
    expect(visualize.stack).toBeDefined();
  });

  it('clones', function () {
    const vis1 = new Visualize('count(span.duration)', {chartType: ChartType.AREA});
    const vis2 = vis1.clone();
    expect(vis1).toEqual(vis2);
  });

  it('replaces yAxes', function () {
    const vis1 = new Visualize('count(span.duration)', {chartType: ChartType.AREA});
    const vis2 = vis1.replace({yAxis: 'avg(span.duration)'});
    expect(vis2).toEqual(
      new Visualize('avg(span.duration)', {chartType: ChartType.AREA})
    );
  });

  it('replaces chart type', function () {
    const vis1 = new Visualize('count(span.duration)', {chartType: ChartType.AREA});
    const vis2 = vis1.replace({chartType: ChartType.LINE});
    expect(vis2).toEqual(
      new Visualize('count(span.duration)', {chartType: ChartType.LINE})
    );
  });

  it('replaces yAxes and chart type', function () {
    const vis1 = new Visualize('count(span.duration)', {chartType: ChartType.AREA});
    const vis2 = vis1.replace({
      yAxis: 'avg(span.duration)',
      chartType: ChartType.LINE,
    });
    expect(vis2).toEqual(
      new Visualize('avg(span.duration)', {chartType: ChartType.LINE})
    );
  });

  it('converts to JSON without chart type', function () {
    const visualize = new Visualize('count(span.duration)');
    expect(visualize.toJSON()).toEqual({
      yAxes: ['count(span.duration)'],
    });
  });

  it('converts to JSON with chart type', function () {
    const visualize = new Visualize('count(span.duration)', {
      chartType: ChartType.AREA,
    });
    expect(visualize.toJSON()).toEqual({
      yAxes: ['count(span.duration)'],
      chartType: ChartType.AREA,
    });
  });

  it('converts from JSON without chart type', function () {
    const visualize = Visualize.fromJSON({
      yAxes: ['count(span.duration)'],
    });
    expect(visualize).toEqual([new Visualize('count(span.duration)')]);
  });

  it('converts from JSON with chart type', function () {
    const visualize = Visualize.fromJSON({
      yAxes: ['count(span.duration)'],
      chartType: ChartType.AREA,
    });
    expect(visualize).toEqual([
      new Visualize('count(span.duration)', {chartType: ChartType.AREA}),
    ]);
  });
});

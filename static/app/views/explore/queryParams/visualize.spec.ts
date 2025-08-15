import {Visualize, VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chart';

describe('VisualizeFunction', function () {
  it.each(['count(span.duration)', 'count_unique(span.op)', 'sum(span.duration)'])(
    'defaults to bar charts for %s',
    function (yAxis) {
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
  ])('defaults to bar charts for %s', function (yAxis) {
    const visualize = new VisualizeFunction(yAxis);
    expect(visualize.chartType).toEqual(ChartType.LINE);
  });

  it('uses selected chart type', function () {
    const visualize = new VisualizeFunction('count(span.duration)', {
      chartType: ChartType.AREA,
    });
    expect(visualize.chartType).toEqual(ChartType.AREA);
  });

  it('clones', function () {
    const vis1 = new VisualizeFunction('count(span.duration)', {
      chartType: ChartType.AREA,
    });
    const vis2 = vis1.clone();
    expect(vis1).toEqual(vis2);
  });

  it('replaces yAxes', function () {
    const vis1 = new VisualizeFunction('count(span.duration)', {
      chartType: ChartType.AREA,
    });
    const vis2 = vis1.replace({yAxis: 'avg(span.duration)'});
    expect(vis2).toEqual(
      new VisualizeFunction('avg(span.duration)', {chartType: ChartType.AREA})
    );
  });

  it('replaces chart type', function () {
    const vis1 = new VisualizeFunction('count(span.duration)', {
      chartType: ChartType.AREA,
    });
    const vis2 = vis1.replace({chartType: ChartType.LINE});
    expect(vis2).toEqual(
      new VisualizeFunction('count(span.duration)', {chartType: ChartType.LINE})
    );
  });

  it('replaces yAxes and chart type', function () {
    const vis1 = new VisualizeFunction('count(span.duration)', {
      chartType: ChartType.AREA,
    });
    const vis2 = vis1.replace({
      yAxis: 'avg(span.duration)',
      chartType: ChartType.LINE,
    });
    expect(vis2).toEqual(
      new VisualizeFunction('avg(span.duration)', {chartType: ChartType.LINE})
    );
  });

  it('converts from JSON without chart type', function () {
    const visualize = Visualize.fromJSON({
      yAxes: ['count(span.duration)'],
    });
    expect(visualize).toEqual([new VisualizeFunction('count(span.duration)')]);
  });

  it('converts from JSON with chart type', function () {
    const visualize = Visualize.fromJSON({
      yAxes: ['count(span.duration)'],
      chartType: ChartType.AREA,
    });
    expect(visualize).toEqual([
      new VisualizeFunction('count(span.duration)', {chartType: ChartType.AREA}),
    ]);
  });
});

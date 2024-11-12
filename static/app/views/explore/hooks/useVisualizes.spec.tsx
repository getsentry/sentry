import {act, render} from 'sentry-test/reactTestingLibrary';

import {useVisualizes} from 'sentry/views/explore/hooks/useVisualizes';
import {ChartType} from 'sentry/views/insights/common/components/chart';

describe('useVisualizes', function () {
  it('allows changing visualizes function', function () {
    let visualizes, setVisualizes;

    function TestPage() {
      [visualizes, setVisualizes] = useVisualizes();
      return null;
    }

    render(<TestPage />, {disableRouterMocks: true});

    expect(visualizes).toEqual([
      {
        chartType: ChartType.LINE,
        label: 'A',
        yAxes: ['count(span.duration)'],
      },
    ]); // default

    act(() => setVisualizes([{yAxes: ['p75(span.duration)'], chartType: ChartType.BAR}]));
    expect(visualizes).toEqual([
      {
        chartType: ChartType.BAR,
        label: 'A',
        yAxes: ['p75(span.duration)'],
      },
    ]);

    act(() => setVisualizes([]));
    expect(visualizes).toEqual([
      {
        chartType: ChartType.LINE,
        label: 'A',
        yAxes: ['count(span.duration)'],
      },
    ]); // default

    act(() => setVisualizes([{yAxes: ['count(span.duration)']}]));
    expect(visualizes).toEqual([
      {
        chartType: ChartType.LINE,
        label: 'A',
        yAxes: ['count(span.duration)'],
      },
    ]); // default

    act(() =>
      setVisualizes([
        {
          yAxes: ['count(span.duration)', 'p75(span.duration)'],
          chartType: ChartType.LINE,
        },
      ])
    );
    expect(visualizes).toEqual([
      {
        chartType: ChartType.LINE,
        label: 'A',
        yAxes: ['count(span.duration)', 'p75(span.duration)'],
      },
    ]);

    act(() =>
      setVisualizes([
        {
          chartType: ChartType.BAR,
          label: 'A',
          yAxes: ['count(span.duration)', 'p75(span.duration)'],
        },
        {
          chartType: ChartType.AREA,
          label: 'B',
          yAxes: ['count(span.duration)'],
        },
      ])
    );
    expect(visualizes).toEqual([
      {
        chartType: ChartType.BAR,
        label: 'A',
        yAxes: ['count(span.duration)', 'p75(span.duration)'],
      },
      {
        chartType: ChartType.AREA,
        label: 'B',
        yAxes: ['count(span.duration)'],
      },
    ]);
  });
});

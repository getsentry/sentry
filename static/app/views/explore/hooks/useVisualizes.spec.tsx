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
      {yAxes: ['count(span.duration)'], chartType: ChartType.LINE},
    ]); // default

    act(() => setVisualizes([{yAxes: ['p75(span.duration)'], chartType: ChartType.BAR}]));
    expect(visualizes).toEqual([
      {yAxes: ['p75(span.duration)'], chartType: ChartType.BAR},
    ]);

    act(() => setVisualizes([]));
    expect(visualizes).toEqual([
      {yAxes: ['count(span.duration)'], chartType: ChartType.LINE},
    ]); // default

    act(() => setVisualizes([{yAxes: ['count(span.duration)']}]));
    expect(visualizes).toEqual([
      {yAxes: ['count(span.duration)'], chartType: ChartType.LINE},
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
      {yAxes: ['count(span.duration)', 'p75(span.duration)'], chartType: ChartType.LINE},
    ]);

    act(() =>
      setVisualizes([
        {yAxes: ['count(span.duration)', 'p75(span.duration)'], chartType: ChartType.BAR},
        {yAxes: ['count(span.duration)'], chartType: ChartType.AREA},
      ])
    );
    expect(visualizes).toEqual([
      {yAxes: ['count(span.duration)', 'p75(span.duration)'], chartType: ChartType.BAR},
      {yAxes: ['count(span.duration)'], chartType: ChartType.AREA},
    ]);
  });
});

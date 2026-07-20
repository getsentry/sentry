import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {EChartDataZoomHandler} from 'sentry/types/echarts';

import {useChartZoom} from './useChartZoom';

const START_VALUE = Date.UTC(2026, 6, 3, 11, 1, 30);
const END_VALUE = Date.UTC(2026, 6, 3, 16, 54, 30);

type UseChartZoomProps = Parameters<typeof useChartZoom>[0];

function dataZoomPayload(
  startValue = START_VALUE,
  endValue = END_VALUE
): Parameters<EChartDataZoomHandler>[0] {
  return {
    type: 'datazoom',
    start: 0,
    end: 100,
    batch: [{startValue, endValue}],
  } as Parameters<EChartDataZoomHandler>[0];
}

describe('useChartZoom', () => {
  it('keeps zoom merge props and the inside dataZoom model across disabled rerenders', () => {
    const {result, rerender} = renderHookWithProviders<
      ReturnType<typeof useChartZoom>,
      UseChartZoomProps
    >((props: UseChartZoomProps) => useChartZoom(props), {
      initialProps: {saveOnZoom: true},
    });

    expect(result.current).toMatchObject({
      isGroupedByDate: true,
      notMerge: false,
      replaceMerge: ['series', 'xAxis', 'yAxis'],
    });
    expect(result.current.dataZoom).toEqual([
      expect.objectContaining({
        id: 'useChartZoom-inside',
        type: 'inside',
      }),
    ]);
    expect(result.current.toolBox).toEqual(
      expect.objectContaining({
        id: 'useChartZoom-toolbox',
      })
    );

    rerender({saveOnZoom: true, disabled: true});

    expect(result.current).toMatchObject({
      isGroupedByDate: true,
      notMerge: false,
      replaceMerge: ['series', 'xAxis', 'yAxis'],
    });
    expect(result.current.dataZoom).toEqual([
      expect.objectContaining({
        id: 'useChartZoom-inside',
        type: 'inside',
      }),
    ]);
    expect(result.current.toolBox).toEqual({});
  });

  it('updates query params from a zoom event and no-ops while disabled', () => {
    const {result, rerender, router} = renderHookWithProviders<
      ReturnType<typeof useChartZoom>,
      UseChartZoomProps
    >((props: UseChartZoomProps) => useChartZoom(props), {
      initialProps: {
        usePageDate: true,
      },
      initialRouterConfig: {
        location: {
          pathname: '/issues/1/',
          query: {project: '11276', statsPeriod: '7d'},
        },
      },
    });

    act(() => {
      result.current.onDataZoom(dataZoomPayload(), {} as any);
    });

    expect(router.location.query).toEqual(
      expect.objectContaining({
        project: '11276',
        start: '2026-07-03T11:01:00',
        end: '2026-07-03T16:55:00',
      })
    );
    expect(router.location.query.statsPeriod).toBeUndefined();

    rerender({
      disabled: true,
      usePageDate: true,
    });

    act(() => {
      result.current.onDataZoom(
        dataZoomPayload(
          Date.UTC(2026, 6, 4, 11, 1, 30),
          Date.UTC(2026, 6, 4, 16, 54, 30)
        ),
        {} as any
      );
    });

    expect(router.location.query).toEqual(
      expect.objectContaining({
        start: '2026-07-03T11:01:00',
        end: '2026-07-03T16:55:00',
      })
    );
  });
});

import {act, render, waitFor} from 'sentry-test/reactTestingLibrary';

import ChartZoom, {type ZoomRenderProps} from 'sentry/components/charts/chartZoom';

function makeZoomChart(startValue: number, endValue: number) {
  return {getModel: () => ({_payload: {batch: [{startValue, endValue}]}})} as any;
}

describe('ChartZoom', () => {
  it('pushes the zoomed range into the page date params while keeping other params when usePageDate is set', async () => {
    let zoomProps!: ZoomRenderProps;
    const onNuqsUrlUpdate = jest.fn();

    const {router} = render(
      <ChartZoom usePageDate period="14d">
        {props => {
          zoomProps = props;
          return null;
        }}
      </ChartZoom>,
      {
        onNuqsUrlUpdate,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/releases/1.0.0/',
            query: {project: '1', pageStatsPeriod: '14d'},
          },
        },
      }
    );

    act(() => {
      zoomProps.onDataZoom?.(
        {type: 'datazoom', start: 0, end: 100},
        makeZoomChart(Date.UTC(2026, 6, 3, 11, 1, 30), Date.UTC(2026, 6, 3, 16, 54, 30))
      );
    });

    await waitFor(() =>
      expect(router.location.query).toEqual({
        project: '1',
        pageStart: '2026-07-03T11:01:30',
        pageEnd: '2026-07-03T16:54:30',
      })
    );
    expect(onNuqsUrlUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({options: expect.objectContaining({history: 'push'})})
    );
  });

  it('skips the URL update when the zoomed range matches the page date params', async () => {
    let zoomProps!: ZoomRenderProps;
    const onNuqsUrlUpdate = jest.fn();

    const {router} = render(
      <ChartZoom usePageDate>
        {props => {
          zoomProps = props;
          return null;
        }}
      </ChartZoom>,
      {
        onNuqsUrlUpdate,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/releases/1.0.0/',
            query: {pageStart: '2026-07-03T11:01:30', pageEnd: '2026-07-03T16:54:30'},
          },
        },
      }
    );

    act(() => {
      zoomProps.onDataZoom?.(
        {type: 'datazoom', start: 0, end: 100},
        makeZoomChart(Date.UTC(2026, 6, 3, 11, 1, 30), Date.UTC(2026, 6, 3, 16, 54, 30))
      );
    });
    // nuqs batches updates queued before its throttled flush, so let the first zoom settle.
    await act(() => new Promise(resolve => setTimeout(resolve, 100)));
    act(() => {
      zoomProps.onDataZoom?.(
        {type: 'datazoom', start: 0, end: 100},
        makeZoomChart(Date.UTC(2026, 6, 4, 11, 1, 30), Date.UTC(2026, 6, 4, 16, 54, 30))
      );
    });

    await waitFor(() => expect(onNuqsUrlUpdate).toHaveBeenCalled());
    expect(onNuqsUrlUpdate).toHaveBeenCalledTimes(1);
    expect(router.location.query).toEqual({
      pageStart: '2026-07-04T11:01:30',
      pageEnd: '2026-07-04T16:54:30',
    });
  });

  it('restores the original page period when the zoom is reset', async () => {
    let zoomProps!: ZoomRenderProps;
    const onNuqsUrlUpdate = jest.fn();

    const {router} = render(
      <ChartZoom usePageDate period="14d">
        {props => {
          zoomProps = props;
          return null;
        }}
      </ChartZoom>,
      {
        onNuqsUrlUpdate,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/releases/1.0.0/',
            query: {project: '1', pageStatsPeriod: '14d'},
          },
        },
      }
    );

    act(() => {
      zoomProps.onDataZoom?.(
        {type: 'datazoom', start: 0, end: 100},
        makeZoomChart(Date.UTC(2026, 6, 3, 11, 1, 30), Date.UTC(2026, 6, 3, 16, 54, 30))
      );
    });
    await waitFor(() => expect(router.location.query.pageStart).toBeDefined());
    act(() => {
      zoomProps.onRestore?.({type: 'restore'}, makeZoomChart(0, 0));
    });

    await waitFor(() =>
      expect(router.location.query).toEqual({project: '1', pageStatsPeriod: '14d'})
    );
    expect(onNuqsUrlUpdate).toHaveBeenCalledTimes(2);
  });

  it('skips the URL update when the zoom is reset after navigating back to the original period', async () => {
    let zoomProps!: ZoomRenderProps;
    const onNuqsUrlUpdate = jest.fn();

    const {router} = render(
      <ChartZoom usePageDate period="14d">
        {props => {
          zoomProps = props;
          return null;
        }}
      </ChartZoom>,
      {
        onNuqsUrlUpdate,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/releases/1.0.0/',
            query: {project: '1', pageStatsPeriod: '14d'},
          },
        },
      }
    );

    act(() => {
      zoomProps.onDataZoom?.(
        {type: 'datazoom', start: 0, end: 100},
        makeZoomChart(Date.UTC(2026, 6, 3, 11, 1, 30), Date.UTC(2026, 6, 3, 16, 54, 30))
      );
    });
    await waitFor(() => expect(router.location.query.pageStart).toBeDefined());
    act(() => {
      router.navigate(-1);
    });
    act(() => {
      zoomProps.onRestore?.({type: 'restore'}, makeZoomChart(0, 0));
    });
    await act(() => new Promise(resolve => setTimeout(resolve, 100)));

    expect(router.location.query).toEqual({project: '1', pageStatsPeriod: '14d'});
    expect(onNuqsUrlUpdate).toHaveBeenCalledTimes(1);
  });
});

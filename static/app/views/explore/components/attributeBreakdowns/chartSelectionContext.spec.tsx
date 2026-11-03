import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  ChartSelectionProvider,
  useChartSelection,
} from 'sentry/views/explore/components/attributeBreakdowns/chartSelectionContext';

describe('ChartSelectionProvider', () => {
  function renderChartSelection(query: Record<string, string> = {}) {
    return renderHookWithProviders(useChartSelection, {
      additionalWrapper: ChartSelectionProvider,
      initialRouterConfig: {location: {pathname: '/mock-pathname/', query}},
    });
  }

  it('reads the selection when the param is valid', () => {
    const {result} = renderChartSelection({
      chartSelection: JSON.stringify({chartIndex: 1, panelId: 'panel', range: [10, 20]}),
    });

    expect(result.current.chartSelection).toEqual({
      chartIndex: 1,
      selection: {panelId: 'panel', range: [10, 20]},
    });
  });

  it.each([
    ['is not JSON', '{"chartIndex":'],
    ['has a range that is too short', '{"chartIndex":1,"panelId":"p","range":[10]}'],
    ['has a range that is too long', '{"chartIndex":1,"panelId":"p","range":[1,2,3]}'],
    ['has a non-finite range', '{"chartIndex":1,"panelId":"p","range":[1e999,2]}'],
    ['has a non-number chart index', '{"chartIndex":"1","panelId":"p","range":[1,2]}'],
    ['has a non-string panel id', '{"chartIndex":1,"panelId":2,"range":[1,2]}'],
  ])('reads no selection when the param %s', (_, chartSelection) => {
    const {result} = renderChartSelection({chartSelection});

    expect(result.current.chartSelection).toBeNull();
  });

  it('writes the selection to the URL when it is set', async () => {
    const {result, router} = renderChartSelection();

    act(() => {
      result.current.setChartSelection({
        chartIndex: 2,
        selection: {panelId: 'panel', range: [30, 40]},
      });
    });

    await waitFor(() =>
      expect(router.location.query.chartSelection).toBe(
        JSON.stringify({chartIndex: 2, range: [30, 40], panelId: 'panel'})
      )
    );
  });
});

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {COL_WIDTH_UNDEFINED} from '@sentry/scraps/table';

import {useQueryBasedColumnResize} from 'sentry/components/tables/dataGrid/useQueryBasedColumnResize';

const columns = [
  {key: 'a', name: 'A'},
  {key: 'b', name: 'B', width: 120},
  {key: 'c', name: 'C'},
];

describe('useQueryBasedColumnResize', () => {
  it('reads repeated width params by position and falls back to the column width', () => {
    const {result} = renderHookWithProviders(useQueryBasedColumnResize, {
      initialProps: {columns},
      initialRouterConfig: {
        location: {pathname: '/table/', query: {width: ['', '200', 'abc']}},
      },
    });

    expect(result.current.columns.map(column => column.width)).toEqual([
      COL_WIDTH_UNDEFINED,
      200,
      COL_WIDTH_UNDEFINED,
    ]);
  });

  it('falls back to the column widths when the width param is absent', () => {
    const {result} = renderHookWithProviders(useQueryBasedColumnResize, {
      initialProps: {columns},
      initialRouterConfig: {location: {pathname: '/table/', query: {}}},
    });

    expect(result.current.columns.map(column => column.width)).toEqual([
      COL_WIDTH_UNDEFINED,
      120,
      COL_WIDTH_UNDEFINED,
    ]);
  });

  it('replaces the width params without trailing unset widths when a column is resized', async () => {
    const {result, router} = renderHookWithProviders(useQueryBasedColumnResize, {
      initialProps: {columns},
      initialRouterConfig: {
        location: {pathname: '/table/', query: {width: '200', query: 'foo'}},
      },
    });

    act(() => {
      result.current.handleResizeColumn(0, {...columns[0]!, width: 300});
    });

    await waitFor(() =>
      expect(router.location.query).toEqual({width: ['300', '120'], query: 'foo'})
    );
    expect(router.historyAction).toBe('REPLACE');
  });
});

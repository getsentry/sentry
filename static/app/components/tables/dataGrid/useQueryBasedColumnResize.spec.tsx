import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {COL_WIDTH_UNDEFINED} from '@sentry/scraps/table';

import type {GridColumnOrder} from 'sentry/components/tables/dataGrid';
import {useQueryBasedColumnResize} from 'sentry/components/tables/dataGrid/useQueryBasedColumnResize';

const columns: Array<GridColumnOrder<string>> = [
  {key: 'name', name: 'Name', width: COL_WIDTH_UNDEFINED},
  {key: 'count', name: 'Count', width: COL_WIDTH_UNDEFINED},
  {key: 'age', name: 'Age', width: COL_WIDTH_UNDEFINED},
];

describe('useQueryBasedColumnResize', () => {
  it('reads column widths from the width query param', () => {
    const {result} = renderHookWithProviders(useQueryBasedColumnResize, {
      initialProps: {columns},
      initialRouterConfig: {location: {pathname: '/table/', query: {width: ['200']}}},
    });

    expect(result.current.columns.map(column => column.width)).toEqual([
      200,
      COL_WIDTH_UNDEFINED,
      COL_WIDTH_UNDEFINED,
    ]);
  });

  it('keeps every width when several columns are resized before the URL updates', async () => {
    const {result, router} = renderHookWithProviders(useQueryBasedColumnResize, {
      initialProps: {columns},
      initialRouterConfig: {location: {pathname: '/table/', query: {}}},
    });

    act(() => {
      result.current.handleResizeColumn(0, {...columns[0]!, width: 500});
      result.current.handleResizeColumn(1, {...columns[1]!, width: 250});
    });

    await waitFor(() => expect(router.location.query.width).toEqual(['500', '250']));
  });
});

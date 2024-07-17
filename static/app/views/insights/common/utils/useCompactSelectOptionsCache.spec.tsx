import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';

describe('useCompactSelectOptionsCache', function () {
  it('keeps a cache', function () {
    const {result, rerender} = renderHook(
      (args: Parameters<typeof useCompactSelectOptionsCache>) => {
        return useCompactSelectOptionsCache(...args);
      },
      {
        initialProps: [
          [
            {value: '', label: 'All'},
            {value: '2', label: '2XX'},
            {value: '3', label: '3XX'},
          ],
        ],
      }
    );

    expect(result.current.options).toEqual([
      {value: '', label: 'All'},
      {value: '2', label: '2XX'},
      {value: '3', label: '3XX'},
    ]);

    rerender([[{value: '4', label: '4XX'}]]);
    rerender([[{value: '5', label: '5XX'}]]);
    expect(result.current.options).toEqual([
      {value: '', label: 'All'},
      {value: '2', label: '2XX'},
      {value: '3', label: '3XX'},
      {value: '4', label: '4XX'},
      {value: '5', label: '5XX'},
    ]);
  });

  it('sorts the output', function () {
    const {result} = renderHook(
      (args: Parameters<typeof useCompactSelectOptionsCache>) => {
        return useCompactSelectOptionsCache(...args);
      },
      {
        initialProps: [
          [
            {value: '3', label: '3XX'},
            {value: '5', label: '5XX'},
            {value: '', label: 'All'},
            {value: '2', label: '2XX'},
            {value: '4', label: '4XX'},
          ],
        ],
      }
    );

    expect(result.current.options).toEqual([
      {value: '', label: 'All'},
      {value: '2', label: '2XX'},
      {value: '3', label: '3XX'},
      {value: '4', label: '4XX'},
      {value: '5', label: '5XX'},
    ]);
  });

  it('clears the cache', function () {
    const {result, rerender} = renderHook(
      (args: Parameters<typeof useCompactSelectOptionsCache>) => {
        return useCompactSelectOptionsCache(...args);
      },
      {
        initialProps: [
          [
            {value: '3', label: '3XX'},
            {value: '5', label: '5XX'},
            {value: '', label: 'All'},
            {value: '2', label: '2XX'},
            {value: '4', label: '4XX'},
          ],
        ],
      }
    );

    expect(result.current.options).toEqual([
      {value: '', label: 'All'},
      {value: '2', label: '2XX'},
      {value: '3', label: '3XX'},
      {value: '4', label: '4XX'},
      {value: '5', label: '5XX'},
    ]);

    result.current.clear();
    rerender([[]]);

    expect(result.current.options).toEqual([]);
  });
});

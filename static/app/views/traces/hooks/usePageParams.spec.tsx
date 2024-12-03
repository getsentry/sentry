import {renderHook} from 'sentry-test/reactTestingLibrary';

import {usePageParams} from 'sentry/views/traces/hooks/usePageParams';

describe('usePageParams', function () {
  it('decodes no queries on page', function () {
    const location = {query: {}};
    const {result} = renderHook(() => usePageParams(location), {
      initialProps: {location},
    });

    expect(result.current.queries).toEqual([]);
  });

  it('decodes single query on page', function () {
    const location = {query: {query: 'query1'}};
    const {result} = renderHook(() => usePageParams(location), {
      initialProps: {location},
    });

    expect(result.current.queries).toEqual(['query1']);
  });

  it('decodes multiple queries on page', function () {
    const location = {query: {query: ['query1', 'query2', 'query3']}};
    const {result} = renderHook(() => usePageParams(location), {
      initialProps: {location},
    });

    expect(result.current.queries).toEqual(['query1', 'query2', 'query3']);
  });
});

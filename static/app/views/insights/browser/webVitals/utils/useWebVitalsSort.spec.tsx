import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {DEFAULT_SORT} from 'sentry/views/insights/browser/webVitals/types';

import {useWebVitalsSort} from './useWebVitalsSort';

describe('useWebVitalsSort', () => {
  it('returns the first sortable sort when the URL repeats the sort key', () => {
    const {result} = renderHookWithProviders(useWebVitalsSort, {
      initialRouterConfig: {
        location: {
          pathname: '/insights/frontend/pageloads/',
          query: {sort: ['-unsortable', 'count()']},
        },
      },
    });

    expect(result.current).toEqual({kind: 'asc', field: 'count()'});
  });

  it('returns the default sort when the URL has no sort', () => {
    const {result} = renderHookWithProviders(useWebVitalsSort, {
      initialRouterConfig: {location: {pathname: '/insights/frontend/pageloads/'}},
    });

    expect(result.current).toEqual(DEFAULT_SORT);
  });
});

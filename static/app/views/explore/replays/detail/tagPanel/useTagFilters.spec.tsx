import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {renderHookWithProviders as renderHook} from 'sentry-test/reactTestingLibrary';

import {useTagFilters} from 'sentry/views/explore/replays/detail/tagPanel/useTagFilters';

const tags = ReplayRecordFixture().tags;

describe('useTagsFilters', () => {
  it('should not filter anything when no values are set', () => {
    const {result} = renderHook(useTagFilters, {
      initialProps: {tags},
    });
    expect(Object.keys(result.current.items)).toHaveLength(10);
  });

  it('should filter by searchTerm', () => {
    const {result} = renderHook(useTagFilters, {
      initialProps: {tags},
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {
            f_t_search: 'Browser',
          },
        },
      },
    });
    expect(result.current.items).toEqual({
      'browser.name': ['Other'],
      'sdk.name': ['sentry.javascript.browser'],
    });
  });
});

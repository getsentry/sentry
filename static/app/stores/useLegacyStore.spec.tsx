import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';

import {useLegacyStore} from './useLegacyStore';

describe('useLegacyStore', () => {
  beforeEach(() => PageFiltersStore.reset());

  it('should update on change to store', () => {
    const {result} = renderHook(useLegacyStore, {initialProps: PageFiltersStore});

    expect(result.current.selection.projects).toEqual([]);

    act(() => PageFiltersStore.updateProjects([1], null));

    expect(result.current.selection.projects).toEqual([1]);
  });
});

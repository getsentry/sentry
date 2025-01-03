import type {Location} from 'history';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import type {FilterFields} from 'sentry/views/replays/detail/tagPanel/useTagFilters';
import useTagFilters from 'sentry/views/replays/detail/tagPanel/useTagFilters';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');

const mockUseLocation = jest.mocked(useLocation);

const tags = ReplayRecordFixture().tags;

describe('useTagsFilters', () => {
  it('should not filter anything when no values are set', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {},
    } as Location<FilterFields>);

    const {result} = renderHook(useTagFilters, {
      initialProps: {tags},
    });
    expect(Object.keys(result.current.items)).toHaveLength(9);
  });

  it('should filter by searchTerm', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_t_search: 'Browser',
      },
    } as Location<FilterFields>);

    const {result} = renderHook(useTagFilters, {
      initialProps: {tags},
    });
    expect(result.current.items).toEqual({
      'browser.name': ['Other'],
      'sdk.name': ['sentry.javascript.browser'],
    });
  });
});

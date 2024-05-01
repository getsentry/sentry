import type {Location} from 'history';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {browserHistory} from 'sentry/utils/browserHistory';
import {useLocation} from 'sentry/utils/useLocation';
import type {FilterFields} from 'sentry/views/replays/detail/tagPanel/useTagFilters';
import useTagFilters from 'sentry/views/replays/detail/tagPanel/useTagFilters';

jest.mock('react-router');
jest.mock('sentry/utils/useLocation');

const mockUseLocation = jest.mocked(useLocation);

const tags = ReplayRecordFixture().tags;

describe('useTagsFilters', () => {
  beforeEach(() => {
    jest.mocked(browserHistory.push).mockReset();
  });

  it('should not filter anything when no values are set', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {},
    } as Location<FilterFields>);

    const {result} = renderHook(useTagFilters, {
      initialProps: {tags},
    });
    expect(Object.keys(result.current.items).length).toEqual(9);
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

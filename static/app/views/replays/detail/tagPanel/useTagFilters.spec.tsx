import {browserHistory} from 'react-router';
import type {Location} from 'history';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import useTagFilters, {
  FilterFields,
} from 'sentry/views/replays/detail/tagPanel/useTagFilters';

jest.mock('react-router');
jest.mock('sentry/utils/useLocation');

const mockUseLocation = jest.mocked(useLocation);

const tags = TestStubs.ReplayRecord().tags;

// const tags = {
//   'browser.name': ['Other'],
//   'device.family': ['Other'],
//   environment: ['demo'],
//   'os.name': ['Other'],
//   platform: ['javascript'],
//   releases: ['1.0.0', '2.0.0'],
//   'sdk.name': ['sentry.javascript.browser'],
//   'sdk.version': ['7.1.1'],
//   'user.ip': ['127.0.0.1'],
// };

describe('useTagsFilters', () => {
  beforeEach(() => {
    jest.mocked(browserHistory.push).mockReset();
  });

  it('should not filter anything when no values are set', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {},
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useTagFilters, {
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

    const {result} = reactHooks.renderHook(useTagFilters, {
      initialProps: {tags},
    });
    expect(Object.keys(result.current.items).length).toEqual(2);
  });
});

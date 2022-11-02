import {browserHistory} from 'react-router';
import type {Location} from 'history';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {Extraction} from 'sentry/utils/replays/hooks/useExtractedCrumbHtml';
import {useLocation} from 'sentry/utils/useLocation';

import useDomFilters, {FilterFields} from './useDomFilters';

jest.mock('react-router');
jest.mock('sentry/utils/useLocation');

const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;
const mockBrowserHistoryPush = browserHistory.push as jest.MockedFunction<
  typeof browserHistory.push
>;

const actions: Extraction[] = [
  {
    crumb: {
      type: BreadcrumbType.DEBUG,
      timestamp: '2022-09-20T16:32:39.961Z',
      level: BreadcrumbLevelType.INFO,
      category: 'default',
      data: {
        action: 'largest-contentful-paint',
        duration: 0,
        size: 17782,
        nodeId: 1126,
        label: 'LCP',
      },
      id: 21,
      color: 'purple300',
      description: 'Debug',
    },
    html: '<div class="css-vruter e1weinmj3">HTTP 400 (invalid_grant): The provided authorization grant is invalid, expired, revoked, does not match the redirection URI used in the authorization request, or was issued to another client.</div>',
    timestamp: 1663691559961,
  },
  {
    crumb: {
      type: BreadcrumbType.UI,
      timestamp: '2022-09-20T16:32:50.812Z',
      category: 'ui.click',
      message: 'li.active > a.css-c5vwnq.e1ycxor00 > span.css-507rzt.e1lk5gpt0',
      data: {
        nodeId: 424,
      },
      id: 4,
      color: 'purple300',
      description: 'User Action',
      level: BreadcrumbLevelType.UNDEFINED,
    },
    html: '<span aria-describedby="tooltip-nxf8deymg3" class="css-507rzt e1lk5gpt0">Ignored <span type="default" class="css-2uol17 e1gotaso0"><span><!-- 1 descendents --></span></span></span>',
    timestamp: 1663691570812,
  },
  {
    crumb: {
      type: BreadcrumbType.UI,
      timestamp: '2022-09-20T16:33:54.529Z',
      category: 'ui.click',
      message: 'div > div.exception > pre.exc-message.css-r7tqg9.e1rtpi7z1',
      data: {
        nodeId: 9304,
      },
      id: 17,
      color: 'purple300',
      description: 'User Action',
      level: BreadcrumbLevelType.UNDEFINED,
    },
    html: '<div class="loadmore" style="display: block;">Load more..</div>',
    timestamp: 1663691634529,
  },
];

describe('useDomFilters', () => {
  beforeEach(() => {
    mockBrowserHistoryPush.mockReset();
  });

  it('should update the url when setters are called', () => {
    const TYPE_FILTER = ['ui'];
    const SEARCH_FILTER = 'aria';

    mockUseLocation
      .mockReturnValueOnce({
        pathname: '/',
        query: {},
      } as Location<FilterFields>)
      .mockReturnValueOnce({
        pathname: '/',
        query: {f_d_type: TYPE_FILTER},
      } as Location<FilterFields>);

    const {result, rerender} = reactHooks.renderHook(useDomFilters, {
      initialProps: {actions},
    });

    result.current.setType(TYPE_FILTER);
    expect(browserHistory.push).toHaveBeenLastCalledWith({
      pathname: '/',
      query: {
        f_d_type: TYPE_FILTER,
      },
    });

    rerender();

    result.current.setSearchTerm(SEARCH_FILTER);
    expect(browserHistory.push).toHaveBeenLastCalledWith({
      pathname: '/',
      query: {
        f_d_type: TYPE_FILTER,
        f_d_search: SEARCH_FILTER,
      },
    });
  });

  it('should not filter anything when no values are set', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {},
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useDomFilters, {initialProps: {actions}});
    expect(result.current.items.length).toEqual(3);
  });

  it('should filter by logLevel', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_d_type: ['ui'],
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useDomFilters, {initialProps: {actions}});
    expect(result.current.items.length).toEqual(2);
  });

  it('should filter by searchTerm', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_d_search: 'aria',
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useDomFilters, {initialProps: {actions}});
    expect(result.current.items.length).toEqual(1);
  });

  it('should filter by searchTerm and logLevel', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_d_search: 'aria',
        f_d_type: ['ui'],
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useDomFilters, {initialProps: {actions}});
    expect(result.current.items.length).toEqual(1);
  });
});

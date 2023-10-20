import {browserHistory} from 'react-router';
import type {Location} from 'history';
import {ReplayClickFrame} from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import type {Extraction} from 'sentry/utils/replays/extractDomNodes';
import hydrateBreadcrumbs from 'sentry/utils/replays/hydrateBreadcrumbs';
import hydrateSpans from 'sentry/utils/replays/hydrateSpans';
import {useLocation} from 'sentry/utils/useLocation';

import useDomFilters, {FilterFields} from './useDomFilters';

jest.mock('react-router');
jest.mock('sentry/utils/useLocation');

const mockUseLocation = jest.mocked(useLocation);

const ACTION_1_DEBUG = {
  frame: hydrateSpans(ReplayRecordFixture(), [
    TestStubs.Replay.LargestContentfulPaintFrame({
      startTimestamp: new Date(1663691559961),
      endTimestamp: new Date(1663691559962),
      data: {
        nodeId: 1126,
        size: 17782,
        value: 0,
      },
    }),
  ])[0],
  html: '<div class="css-vruter e1weinmj3">HTTP 400 (invalid_grant): The provided authorization grant is invalid, expired, revoked, does not match the redirection URI used in the authorization request, or was issued to another client.</div>',
  timestamp: 1663691559961,
};

const ACTION_2_CLICK = {
  frame: hydrateBreadcrumbs(ReplayRecordFixture(), [
    ReplayClickFrame({
      timestamp: new Date(1663691570812),
      data: {
        nodeId: 424,
      },
    }),
  ])[0],
  html: '<span aria-describedby="tooltip-nxf8deymg3" class="css-507rzt e1lk5gpt0">Ignored <span type="default" class="css-2uol17 e1gotaso0"><span><!-- 1 descendents --></span></span></span>',
  timestamp: 1663691570812,
};

const ACTION_3_CLICK = {
  frame: hydrateBreadcrumbs(ReplayRecordFixture(), [
    ReplayClickFrame({
      timestamp: new Date(1663691634529),
      data: {
        nodeId: 9304,
      },
    }),
  ])[0],
  html: '<div class="loadmore" style="display: block;">Load more..</div>',
  timestamp: 1663691634529,
};

describe('useDomFilters', () => {
  const actions: Extraction[] = [ACTION_1_DEBUG, ACTION_2_CLICK, ACTION_3_CLICK];

  beforeEach(() => {
    jest.mocked(browserHistory.push).mockReset();
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
        f_d_type: ['ui.click'],
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
        f_d_type: ['ui.click'],
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useDomFilters, {initialProps: {actions}});
    expect(result.current.items.length).toEqual(1);
  });
});

describe('getMutationsTypes', () => {
  it('should return a sorted list of BreadcrumbType', () => {
    const actions = [ACTION_1_DEBUG, ACTION_2_CLICK];

    const {result} = reactHooks.renderHook(useDomFilters, {initialProps: {actions}});
    expect(result.current.getMutationsTypes()).toStrictEqual([
      {label: 'LCP', value: 'largest-contentful-paint'},
      {label: 'User Click', value: 'ui.click'},
    ]);
  });

  it('should deduplicate BreadcrumbType', () => {
    const actions = [ACTION_1_DEBUG, ACTION_2_CLICK, ACTION_3_CLICK];

    const {result} = reactHooks.renderHook(useDomFilters, {initialProps: {actions}});
    expect(result.current.getMutationsTypes()).toStrictEqual([
      {label: 'LCP', value: 'largest-contentful-paint'},
      {label: 'User Click', value: 'ui.click'},
    ]);
  });
});

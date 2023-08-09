import {browserHistory} from 'react-router';
import type {Location} from 'history';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

// import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
// import hydrateBreadcrumbs from 'sentry/utils/replays/hydrateBreadcrumbs';
// import hydrateSpans from 'sentry/utils/replays/hydrateSpans';
import {useLocation} from 'sentry/utils/useLocation';
import type {ReplayTraceRow} from 'sentry/views/replays/detail/perfTable/useReplayPerfData';

import usePerfFilters, {FilterFields} from './usePerfFilters';

jest.mock('react-router');
jest.mock('sentry/utils/useLocation');

const mockUseLocation = jest.mocked(useLocation);

// const ACTION_1_DEBUG = {
//   frame: hydrateSpans(TestStubs.ReplayRecord(), [
//     TestStubs.Replay.LargestContentfulPaintFrame({
//       startTimestamp: new Date(1663691559961),
//       endTimestamp: new Date(1663691559962),
//       data: {
//         nodeId: 1126,
//         size: 17782,
//         value: 0,
//       },
//     }),
//   ])[0],
//   html: '<div class="css-vruter e1weinmj3">HTTP 400 (invalid_grant): The provided authorization grant is invalid, expired, revoked, does not match the redirection URI used in the authorization request, or was issued to another client.</div>',
//   timestamp: 1663691559961,
// };

describe('usePerfFilters', () => {
  const traceRows: ReplayTraceRow[] = []; // TODO

  beforeEach(() => {
    jest.mocked(browserHistory.push).mockReset();
  });

  it('should update the url when setters are called', () => {
    const TYPE_OPTION = {
      value: 'ui',
      label: 'ui',
      qs: 'f_p_type' as const,
    }; // TODO
    const SEARCH_FILTER = 'aria'; // TODO

    mockUseLocation
      .mockReturnValueOnce({
        pathname: '/',
        query: {},
      } as Location<FilterFields>)
      .mockReturnValueOnce({
        pathname: '/',
        query: {f_p_type: [TYPE_OPTION.value]},
      } as Location<FilterFields>);

    const {result, rerender} = reactHooks.renderHook(usePerfFilters, {
      initialProps: {traceRows},
    });

    result.current.setFilters([TYPE_OPTION]);
    expect(browserHistory.push).toHaveBeenLastCalledWith({
      pathname: '/',
      query: {
        f_p_type: [TYPE_OPTION.value],
      },
    });

    rerender();

    result.current.setSearchTerm(SEARCH_FILTER);
    expect(browserHistory.push).toHaveBeenLastCalledWith({
      pathname: '/',
      query: {
        f_p_type: [TYPE_OPTION.value],
        f_d_search: SEARCH_FILTER,
      },
    });
  });

  it('should not filter anything when no values are set', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {},
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(usePerfFilters, {initialProps: {traceRows}});
    expect(result.current.items.length).toEqual(3);
  });

  it('should filter by logLevel', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_p_type: ['ui.click'],
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(usePerfFilters, {initialProps: {traceRows}});
    expect(result.current.items.length).toEqual(2);
  });

  it('should filter by searchTerm', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_p_search: 'aria',
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(usePerfFilters, {initialProps: {traceRows}});
    expect(result.current.items.length).toEqual(1);
  });

  it('should filter by searchTerm and logLevel', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_p_search: 'aria',
        f_p_type: ['ui.click'],
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(usePerfFilters, {initialProps: {traceRows}});
    expect(result.current.items.length).toEqual(1);
  });
});

describe('getMutationsTypes', () => {
  it('should return a sorted list of BreadcrumbType', () => {
    const traceRows = []; // ACTION_1_DEBUG, ACTION_2_CLICK];

    const {result} = reactHooks.renderHook(usePerfFilters, {initialProps: {traceRows}});
    expect(result.current.getCrumbTypes()).toStrictEqual([
      {label: 'LCP', value: 'largest-contentful-paint'},
      {label: 'User Click', value: 'ui.click'},
    ]);
  });

  it('should deduplicate BreadcrumbType', () => {
    const traceRows = []; // ACTION_1_DEBUG, ACTION_2_CLICK, ACTION_3_CLICK];

    const {result} = reactHooks.renderHook(usePerfFilters, {initialProps: {traceRows}});
    expect(result.current.getCrumbTypes()).toStrictEqual([
      {label: 'LCP', value: 'largest-contentful-paint'},
      {label: 'User Click', value: 'ui.click'},
    ]);
  });
});

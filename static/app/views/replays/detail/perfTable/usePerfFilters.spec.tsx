import {browserHistory} from 'react-router';
import type {Location} from 'history';
import {ReplayClickFrameFixture} from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import {
  ReplayLargestContentfulPaintFrameFixture,
  ReplayNavigationFrameFixture,
} from 'sentry-fixture/replay/replaySpanFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import hydrateBreadcrumbs from 'sentry/utils/replays/hydrateBreadcrumbs';
import hydrateSpans from 'sentry/utils/replays/hydrateSpans';
import {LargestContentfulPaintFrame} from 'sentry/utils/replays/types';
import {useLocation} from 'sentry/utils/useLocation';
import type {ReplayTraceRow} from 'sentry/views/replays/detail/perfTable/useReplayPerfData';

import usePerfFilters, {FilterFields} from './usePerfFilters';

jest.mock('react-router');
jest.mock('sentry/utils/useLocation');

const mockUseLocation = jest.mocked(useLocation);
const mockRRWebFrames = []; // This is only needed for replay.hydrate-error breadcrumbs.

const replayRecord = ReplayRecordFixture();

const CRUMB_1_NAV: ReplayTraceRow = {
  durationMs: 100,
  flattenedTraces: [],
  lcpFrames: hydrateSpans(replayRecord, [
    ReplayLargestContentfulPaintFrameFixture({
      startTimestamp: new Date(1663691559961),
      endTimestamp: new Date(1663691559962),
      data: {
        nodeId: 1126,
        size: 17782,
        value: 0,
      },
    }),
  ]) as LargestContentfulPaintFrame[],
  offsetMs: 100,
  paintFrames: [],
  replayFrame: hydrateSpans(replayRecord, [
    ReplayNavigationFrameFixture({
      startTimestamp: new Date(1663691559961),
      endTimestamp: new Date(1663691559962),
    }),
  ])[0],
  timestampMs: 1663691559961,
  traces: [],
};

const CRUMB_2_CLICK: ReplayTraceRow = {
  durationMs: 100,
  flattenedTraces: [],
  lcpFrames: [],
  offsetMs: 100,
  paintFrames: [],
  replayFrame: hydrateBreadcrumbs(
    replayRecord,
    [
      ReplayClickFrameFixture({
        timestamp: new Date(1663691559961),
      }),
    ],
    mockRRWebFrames
  )[0],
  timestampMs: 1663691560061,
  traces: [],
};

describe('usePerfFilters', () => {
  const traceRows: ReplayTraceRow[] = [CRUMB_1_NAV, CRUMB_2_CLICK];

  beforeEach(() => {
    jest.mocked(browserHistory.replace).mockReset();
  });

  it('should update the url when setters are called', () => {
    const TYPE_OPTION = {
      value: 'ui.click',
      label: 'User Click',
      qs: 'f_p_type' as const,
    };

    mockUseLocation
      .mockReturnValueOnce({
        pathname: '/',
        query: {},
      } as Location<FilterFields>)
      .mockReturnValueOnce({
        pathname: '/',
        query: {f_p_type: [TYPE_OPTION.value]},
      } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(usePerfFilters, {
      initialProps: {traceRows},
    });

    result.current.setFilters([TYPE_OPTION]);
    expect(browserHistory.replace).toHaveBeenLastCalledWith({
      pathname: '/',
      query: {
        f_p_type: [TYPE_OPTION.value],
      },
    });
  });

  it('should not filter anything when no values are set', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {},
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(usePerfFilters, {initialProps: {traceRows}});
    expect(result.current.items.length).toEqual(1);
  });

  it('should filter by crumb type', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_p_type: ['ui.click'],
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(usePerfFilters, {initialProps: {traceRows}});
    expect(result.current.items.length).toEqual(1);
  });
});

describe('getCrumbTypes', () => {
  it('should return a sorted list of crumb types', () => {
    const traceRows = [CRUMB_1_NAV, CRUMB_2_CLICK]; // ACTION_1_DEBUG, ACTION_2_CLICK];

    const {result} = reactHooks.renderHook(usePerfFilters, {initialProps: {traceRows}});
    expect(result.current.getCrumbTypes()).toStrictEqual([
      {label: 'Page Load', qs: 'f_p_type', value: 'navigation.navigate'},
      {label: 'User Click', qs: 'f_p_type', value: 'ui.click'},
    ]);
  });

  it('should deduplicate crumb types', () => {
    const traceRows = [CRUMB_1_NAV, CRUMB_2_CLICK, CRUMB_2_CLICK];

    const {result} = reactHooks.renderHook(usePerfFilters, {initialProps: {traceRows}});
    expect(result.current.getCrumbTypes()).toStrictEqual([
      {label: 'Page Load', qs: 'f_p_type', value: 'navigation.navigate'},
      {label: 'User Click', qs: 'f_p_type', value: 'ui.click'},
    ]);
  });
});

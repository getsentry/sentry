import {useEffect} from 'react';
import {browserHistory} from 'react-router';
import {Query} from 'history';
import * as qs from 'query-string';

import {DeepPartial} from 'sentry/types/utils';
import {useFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {Rect} from 'sentry/utils/profiling/gl/utils';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';

import {DEFAULT_FLAMEGRAPH_STATE, FlamegraphState} from './flamegraphContext';

// Intersect the types so we can properly guard
type PossibleQuery =
  | Query
  | (Pick<FlamegraphState['preferences'], 'colorCoding' | 'sorting' | 'view' | 'xAxis'> &
      Pick<FlamegraphState['search'], 'query'>);

function isColorCoding(
  value: PossibleQuery['colorCoding'] | FlamegraphState['preferences']['colorCoding']
): value is FlamegraphState['preferences']['colorCoding'] {
  if (typeof value !== 'string') {
    return false;
  }

  return (
    value === 'by symbol name' ||
    value === 'by system / application' ||
    value === 'by library' ||
    value === 'by recursion' ||
    value === 'by frequency'
  );
}

function isLayout(
  value: PossibleQuery['colorCoding'] | FlamegraphState['preferences']['colorCoding']
): value is FlamegraphState['preferences']['layout'] {
  if (typeof value !== 'string') {
    return false;
  }
  return value === 'table right' || value === 'table bottom' || value === 'table left';
}

function isSorting(
  value: PossibleQuery['sorting'] | FlamegraphState['preferences']['sorting']
): value is FlamegraphState['preferences']['sorting'] {
  if (typeof value !== 'string') {
    return false;
  }
  return value === 'left heavy' || value === 'call order';
}

function isView(
  value: PossibleQuery['view'] | FlamegraphState['preferences']['view']
): value is FlamegraphState['preferences']['view'] {
  if (typeof value !== 'string') {
    return false;
  }
  return value === 'top down' || value === 'bottom up';
}

function isXAxis(
  value: PossibleQuery['xAxis'] | FlamegraphState['preferences']['xAxis']
): value is FlamegraphState['preferences']['xAxis'] {
  if (typeof value !== 'string') {
    return false;
  }
  return value === 'profile' || value === 'transaction' || value === 'standalone';
}

export function decodeFlamegraphStateFromQueryParams(
  query: qs.ParsedQuery
): DeepPartial<FlamegraphState> {
  return {
    profiles: {
      highlightFrames:
        typeof query.frameName === 'string' && typeof query.framePackage === 'string'
          ? {
              name: query.frameName,
              package: query.framePackage,
            }
          : null,
      threadId:
        typeof query.tid === 'string' && !isNaN(parseInt(query.tid, 10))
          ? parseInt(query.tid, 10)
          : null,
    },
    position: {view: Rect.decode(query.fov) ?? Rect.Empty()},
    preferences: {
      layout: isLayout(query.layout)
        ? query.layout
        : DEFAULT_FLAMEGRAPH_STATE.preferences.layout,
      colorCoding: isColorCoding(query.colorCoding)
        ? query.colorCoding
        : DEFAULT_FLAMEGRAPH_STATE.preferences.colorCoding,
      sorting: isSorting(query.sorting)
        ? query.sorting
        : DEFAULT_FLAMEGRAPH_STATE.preferences.sorting,
      view: isView(query.view) ? query.view : DEFAULT_FLAMEGRAPH_STATE.preferences.view,
      xAxis: isXAxis(query.xAxis)
        ? query.xAxis
        : DEFAULT_FLAMEGRAPH_STATE.preferences.xAxis,
    },
    search: {
      query: typeof query.query === 'string' ? query.query : '',
    },
  };
}

export function encodeFlamegraphStateToQueryParams(state: FlamegraphState) {
  const highlightFrame = state.profiles.highlightFrames
    ? {
        frameName: state.profiles.highlightFrames?.name,
        framePackage: state.profiles.highlightFrames?.package,
      }
    : {};

  return {
    colorCoding: state.preferences.colorCoding,
    sorting: state.preferences.sorting,
    view: state.preferences.view,
    xAxis: state.preferences.xAxis,
    query: state.search.query,
    ...highlightFrame,
    ...(state.position.view.isEmpty()
      ? {fov: undefined}
      : {fov: Rect.encode(state.position.view)}),
    ...(typeof state.profiles.threadId === 'number'
      ? {tid: state.profiles.threadId}
      : {}),
  };
}

function maybeOmitHighlightedFrame(query: Query, state: FlamegraphState) {
  if (!state.profiles.highlightFrames && query.frameName && query.framePackage) {
    const {frameName: _, framePackage: __, ...rest} = query;
    return rest;
  }
  return query;
}

export function FlamegraphStateQueryParamSync() {
  const location = useLocation();
  const [state] = useFlamegraphState();

  useEffect(() => {
    browserHistory.replace({
      ...location,
      query: {
        ...maybeOmitHighlightedFrame(location.query, state),
        ...encodeFlamegraphStateToQueryParams(state),
      },
    });
    // We only want to sync the query params when the state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return null;
}

export const FLAMEGRAPH_LOCALSTORAGE_PREFERENCES_KEY = 'flamegraph-preferences';
export function FlamegraphStateLocalStorageSync() {
  const [state] = useFlamegraphState();
  const [_, setState] = useLocalStorageState<DeepPartial<FlamegraphState>>(
    FLAMEGRAPH_LOCALSTORAGE_PREFERENCES_KEY,
    {
      preferences: {
        layout: DEFAULT_FLAMEGRAPH_STATE.preferences.layout,
        timelines: DEFAULT_FLAMEGRAPH_STATE.preferences.timelines,
      },
    }
  );

  useEffect(() => {
    setState({
      preferences: {
        layout: state.preferences.layout,
        timelines: state.preferences.timelines,
      },
    });
    // We only want to sync the local storage when the state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.preferences.layout, state.preferences.timelines]);

  return null;
}

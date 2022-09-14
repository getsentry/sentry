import {useEffect} from 'react';
import {browserHistory} from 'react-router';
import {Query} from 'history';

import {DeepPartial} from 'sentry/types/utils';
import {useFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {Rect} from 'sentry/utils/profiling/gl/utils';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';

import {
  FlamegraphAxisOptions,
  FlamegraphColorCodings,
  FlamegraphSorting,
  FlamegraphViewOptions,
} from './reducers/flamegraphPreferences';
import {DEFAULT_FLAMEGRAPH_STATE, FlamegraphState} from './flamegraphContext';

// Intersect the types so we can properly guard
type PossibleQuery =
  | Query
  | (Pick<FlamegraphState['preferences'], 'colorCoding' | 'sorting' | 'view' | 'xAxis'> &
      Pick<FlamegraphState['search'], 'query'>);

function isColorCoding(
  value: PossibleQuery['colorCoding'] | FlamegraphState['preferences']['colorCoding']
): value is FlamegraphState['preferences']['colorCoding'] {
  const values: FlamegraphColorCodings = [
    'by symbol name',
    'by system / application',
    'by library',
    'by recursion',
    'by frequency',
  ];

  return values.includes(value as any);
}

function isLayout(
  value: PossibleQuery['colorCoding'] | FlamegraphState['preferences']['colorCoding']
): value is FlamegraphState['preferences']['layout'] {
  return value === 'table right' || value === 'table bottom' || value === 'table left';
}

function isSorting(
  value: PossibleQuery['sorting'] | FlamegraphState['preferences']['sorting']
): value is FlamegraphState['preferences']['sorting'] {
  const values: FlamegraphSorting = ['left heavy', 'call order'];
  return values.includes(value as any);
}

function isView(
  value: PossibleQuery['view'] | FlamegraphState['preferences']['view']
): value is FlamegraphState['preferences']['view'] {
  const values: FlamegraphViewOptions = ['top down', 'bottom up'];
  return values.includes(value as any);
}

function isXAxis(
  value: PossibleQuery['xAxis'] | FlamegraphState['preferences']['xAxis']
): value is FlamegraphState['preferences']['xAxis'] {
  const values: FlamegraphAxisOptions = ['standalone', 'transaction'];
  return values.includes(value as any);
}

export function decodeFlamegraphStateFromQueryParams(
  query: Query
): DeepPartial<FlamegraphState> {
  return {
    profiles: {
      highlightFrame:
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
  const highlightFrame = state.profiles.highlightFrame
    ? {
        frameName: state.profiles.highlightFrame?.name,
        framePackage: state.profiles.highlightFrame?.package,
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
  if (!state.profiles.highlightFrame && query.frameName && query.framePackage) {
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
      },
    }
  );

  useEffect(() => {
    setState({
      preferences: {
        layout: state.preferences.layout,
      },
    });
    // We only want to sync the local storage when the state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.preferences.layout]);

  return null;
}

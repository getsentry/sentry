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
  | (Pick<FlamegraphState['preferences'], 'colorCoding' | 'sorting' | 'view'> &
      Pick<FlamegraphState['search'], 'query'>);

function isColorCoding(
  value: PossibleQuery['colorCoding'] | FlamegraphState['preferences']['colorCoding']
): value is FlamegraphState['preferences']['colorCoding'] {
  if (typeof value !== 'string') {
    return false;
  }

  return (
    value === 'by symbol name' ||
    value === 'by system frame' ||
    value === 'by application frame' ||
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
  return value === 'left heavy' || value === 'call order' || value === 'alphabetical';
}

function isView(
  value: PossibleQuery['view'] | FlamegraphState['preferences']['view']
): value is FlamegraphState['preferences']['view'] {
  if (typeof value !== 'string') {
    return false;
  }
  return value === 'top down' || value === 'bottom up';
}

export function decodeFlamegraphStateFromQueryParams(
  query: qs.ParsedQuery
): DeepPartial<FlamegraphState> {
  const decoded: DeepPartial<FlamegraphState> = {};

  if (typeof query.frameName === 'string' && typeof query.framePackage === 'string') {
    decoded.profiles = {
      ...(decoded.profiles ?? {}),
      highlightFrames: {
        name: query.frameName,
        package: query.framePackage,
      },
    };
  }

  if (typeof query.tid === 'string' && !isNaN(parseInt(query.tid, 10))) {
    decoded.profiles = {
      ...(decoded.profiles ?? {}),
      threadId: parseInt(query.tid, 10),
    };
  }

  const fov = Rect.decode(query.fov);
  if (fov) {
    decoded.position = {view: fov};
  }

  decoded.preferences = {};
  decoded.search = {};

  if (isLayout(query.layout)) {
    decoded.preferences.layout = query.layout;
  }
  if (isColorCoding(query.colorCoding)) {
    decoded.preferences.colorCoding = query.colorCoding;
  }
  if (isSorting(query.sorting)) {
    decoded.preferences.sorting = query.sorting;
  }

  if (isView(query.view)) {
    decoded.preferences.view = query.view;
  }
  if (typeof query.query === 'string') {
    decoded.search.query = query.query;
  }

  return decoded;
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
        view: DEFAULT_FLAMEGRAPH_STATE.preferences.view,
        colorCoding: DEFAULT_FLAMEGRAPH_STATE.preferences.colorCoding,
        sorting: DEFAULT_FLAMEGRAPH_STATE.preferences.sorting,
      },
    }
  );

  useEffect(() => {
    setState({
      preferences: {
        layout: state.preferences.layout,
        timelines: state.preferences.timelines,
        view: state.preferences.view,
        colorCoding: state.preferences.colorCoding,
        sorting: state.preferences.sorting,
      },
    });
  }, [
    state.preferences.sorting,
    state.preferences.layout,
    state.preferences.timelines,
    state.preferences.view,
    state.preferences.colorCoding,
    setState,
  ]);

  return null;
}

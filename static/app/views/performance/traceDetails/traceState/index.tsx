import {makeCombinedReducers} from 'sentry/utils/makeCombinedReducer';
import {tracePreferencesReducer} from 'sentry/views/performance/traceDetails/traceState/tracePreferences';
import {traceRovingTabIndexReducer} from 'sentry/views/performance/traceDetails/traceState/traceRovingTabIndex';
import {traceSearchReducer} from 'sentry/views/performance/traceDetails/traceState/traceSearch';
import {traceTabsReducer} from 'sentry/views/performance/traceDetails/traceState/traceTabs';

// Ensure that TS will throw an error if we forget to handle a reducer action case.
// We do this because the reducer is combined with other reducers and we want to ensure
// that we handle all possible actions from inside this reducer.
export function traceReducerExhaustiveActionCheck(_x: never): void {}

export const TraceReducer = makeCombinedReducers({
  tabs: traceTabsReducer,
  search: traceSearchReducer,
  rovingTabIndex: traceRovingTabIndexReducer,
  preferences: tracePreferencesReducer,
});

export type TraceReducerState = ReturnType<typeof TraceReducer>;
export type TraceReducerAction = Parameters<typeof TraceReducer>[1];

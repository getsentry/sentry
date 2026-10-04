import {makeCombinedReducers} from 'sentry/utils/makeCombinedReducer';
import {tracePreferencesReducer} from 'sentry/views/performance/traceDetails/traceState/tracePreferences';
import {traceRovingTabIndexReducer} from 'sentry/views/performance/traceDetails/traceState/traceRovingTabIndex';
import {traceSearchReducer} from 'sentry/views/performance/traceDetails/traceState/traceSearch';
import {traceTabsReducer} from 'sentry/views/performance/traceDetails/traceState/traceTabs';

export {traceReducerExhaustiveActionCheck} from './traceReducerUtils';

export const TraceReducer = makeCombinedReducers({
  tabs: traceTabsReducer,
  search: traceSearchReducer,
  rovingTabIndex: traceRovingTabIndexReducer,
  preferences: tracePreferencesReducer,
});

export type TraceReducerState = ReturnType<typeof TraceReducer>;
export type TraceReducerAction = Parameters<typeof TraceReducer>[1];

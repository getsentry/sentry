import {makeCombinedReducers} from 'sentry/utils/makeCombinedReducer';

import {tracePreferencesReducer} from './tracePreferences';
import {traceRovingTabIndexReducer} from './traceRovingTabIndex';
import {traceSearchReducer} from './traceSearch';
import {traceTabsReducer} from './traceTabs';

export const TraceReducer = makeCombinedReducers({
  tabs: traceTabsReducer,
  search: traceSearchReducer,
  rovingTabIndex: traceRovingTabIndexReducer,
  preferences: tracePreferencesReducer,
});

export type TraceReducerState = ReturnType<typeof TraceReducer>;
export type TraceReducerAction = Parameters<typeof TraceReducer>[1];

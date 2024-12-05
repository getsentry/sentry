import {
  createContext,
  type Dispatch,
  type Reducer,
  useCallback,
  useContext,
  useReducer,
} from 'react';

export const enum SectionKey {
  /**
   * Trace timeline or linked error
   */
  TRACE = 'trace',

  USER_FEEDBACK = 'user-feedback',
  LLM_MONITORING = 'llm-monitoring',

  UPTIME = 'uptime', // Only Uptime issues
  DOWNTIME = 'downtime',
  CRON_TIMELINE = 'cron-timeline', // Only Cron issues

  HIGHLIGHTS = 'highlights',
  RESOURCES = 'resources', // Position controlled by flag

  EXCEPTION = 'exception',
  STACKTRACE = 'stacktrace',
  THREADS = 'threads',
  SPANS = 'spans',
  EVIDENCE = 'evidence',
  MESSAGE = 'message',

  SUSPECT_ROOT_CAUSE = 'suspect-root-cause',

  SPAN_EVIDENCE = 'span-evidence',
  HYDRATION_DIFF = 'hydration-diff',
  REPLAY = 'replay',

  HPKP = 'hpkp',
  CSP = 'csp',
  EXPECTCT = 'expectct',
  EXPECTSTAPLE = 'expectstaple',
  TEMPLATE = 'template',

  BREADCRUMBS = 'breadcrumbs',
  /**
   * Also called images loaded
   */
  DEBUGMETA = 'debugmeta',
  REQUEST = 'request',

  TAGS = 'tags',
  SCREENSHOT = 'screenshot',
  FEATURE_FLAGS = 'feature-flags',

  CONTEXTS = 'contexts',
  EXTRA = 'extra',
  PACKAGES = 'packages',
  DEVICE = 'device',
  VIEW_HIERARCHY = 'view-hierarchy',
  ATTACHMENTS = 'attachments',
  SDK = 'sdk',
  GROUPING_INFO = 'grouping-info',
  PROCESSING_ERROR = 'processing-error',
  RRWEB = 'rrweb', // Legacy integration prior to replays

  MERGED_ISSUES = 'merged',
  SIMILAR_ISSUES = 'similar',

  REGRESSION_SUMMARY = 'regression-summary',
  REGRESSION_BREAKPOINT_CHART = 'regression-breakpoint-chart',
  REGRESSION_FLAMEGRAPH = 'regression-flamegraph',
  REGRESSION_PROFILE_COMPARISON = 'regression-profile-comparison',
  REGRESSION_EVENT_COMPARISON = 'regression-event-comparison',
  REGRESSION_POTENTIAL_CAUSES = 'regression-potential-causes',
  REGRESSION_AFFECTED_TRANSACTIONS = 'regression-affected-transactions',
}

/**
 * This can be extended to create shared state for each section.
 * For example, if we needed to know the number of context cards we're rendering,
 * the <ContextDataSection /> can update the config for other components to read from.
 */
export interface SectionConfig {
  key: SectionKey;
  initialCollapse?: boolean;
}

export interface EventDetailsContextType extends EventDetailsState {
  dispatch: Dispatch<EventDetailsActions>;
}

export const EventDetailsContext = createContext<EventDetailsContextType>({
  sectionData: {},
  dispatch: () => {},
});

export function useEventDetails() {
  return useContext(EventDetailsContext);
}

export interface EventDetailsState {
  sectionData: {
    [key in SectionKey]?: SectionConfig;
  };
  navScrollMargin?: number;
}

type UpdateSectionAction = {
  key: SectionKey;
  type: 'UPDATE_SECTION';
  config?: Partial<SectionConfig>;
};

type UpdateDetailsAction = {
  type: 'UPDATE_DETAILS';
  state?: Omit<EventDetailsState, 'sectionData'>;
};

export type EventDetailsActions = UpdateSectionAction | UpdateDetailsAction;

function updateSection(
  state: EventDetailsState,
  sectionKey: SectionKey,
  updatedConfig: Partial<SectionConfig>
): EventDetailsState {
  const existingConfig = state.sectionData[sectionKey] ?? {key: sectionKey};
  const nextState: EventDetailsState = {
    ...state,
    sectionData: {
      ...state.sectionData,
      [sectionKey]: {...existingConfig, ...updatedConfig},
    },
  };
  return nextState;
}

/**
 * If trying to use the current state of the event page, you likely want to use `useEventDetails`
 * instead. This hook is just meant to create state for the provider.
 */
export function useEventDetailsReducer() {
  const initialState: EventDetailsState = {
    sectionData: {},
  };

  const reducer: Reducer<EventDetailsState, EventDetailsActions> = useCallback(
    (state, action): EventDetailsState => {
      switch (action.type) {
        case 'UPDATE_SECTION':
          return updateSection(state, action.key, action.config ?? {});
        case 'UPDATE_DETAILS':
          return {...state, ...action.state};
        default:
          return state;
      }
    },
    []
  );

  const [eventDetails, dispatch] = useReducer(reducer, initialState);

  return {
    eventDetails,
    dispatch,
  };
}

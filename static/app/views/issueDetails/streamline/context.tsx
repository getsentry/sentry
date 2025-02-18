import {
  createContext,
  type Dispatch,
  type Reducer,
  useCallback,
  useContext,
  useReducer,
} from 'react';

import type {DetectorDetails} from 'sentry/views/issueDetails/streamline/sidebar/detectorSection';

export const enum SectionKey {
  /**
   * Trace timeline or linked error
   */
  TRACE = 'trace',

  USER_FEEDBACK = 'user-feedback',
  LLM_MONITORING = 'llm-monitoring',
  SOLUTIONS_HUB = 'solutions-hub',

  UPTIME = 'uptime', // Only Uptime issues
  DOWNTIME = 'downtime',
  CRON_TIMELINE = 'cron-timeline', // Only Cron issues
  CORRELATED_ISSUES = 'correlated-issues', // Only Metric issues
  CORRELATED_TRANSACTIONS = 'correlated-transactions', // Only Metric issues

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

export interface IssueDetailsContextType extends IssueDetailsState {
  dispatch: Dispatch<IssueDetailsActions>;
}

export const IssueDetailsContext = createContext<IssueDetailsContextType>({
  sectionData: {},
  detectorDetails: {},
  isSidebarOpen: true,
  navScrollMargin: 0,
  eventCount: 0,
  activeSection: null,
  dispatch: () => {},
});

export function useIssueDetails() {
  return useContext(IssueDetailsContext);
}

export interface IssueDetailsState {
  /**
   * Detector details for the current issue
   */
  detectorDetails: DetectorDetails;
  /**
   * Allows updating the event count based on the date/time/environment filters.
   */
  eventCount: number;
  /**
   * Controls whether the sidebar is open.
   */
  isSidebarOpen: boolean;
  /**
   * The margin to add to the 'Jump To' nav (accounts for the main app sidebar on small screen sizes).
   */
  navScrollMargin: number;
  /**
   * Controls the state of each section.
   */
  sectionData: {
    [key in SectionKey]?: SectionConfig;
  };
  /**
   * Tracks which section is currently most visible in the viewport based on
   * its proximity to the activation offset
   */
  activeSection: string | null;
}

type UpdateEventSectionAction = {
  key: SectionKey;
  type: 'UPDATE_EVENT_SECTION';
  config?: Partial<SectionConfig>;
};

type UpdateNavScrollMarginAction = {
  margin: number;
  type: 'UPDATE_NAV_SCROLL_MARGIN';
};

type UpdateEventCountAction = {
  count: number;
  type: 'UPDATE_EVENT_COUNT';
};

type UpdateSidebarAction = {
  isOpen: boolean;
  type: 'UPDATE_SIDEBAR_STATE';
};

type UpdateDetectorDetailsAction = {
  detectorDetails: DetectorDetails;
  type: 'UPDATE_DETECTOR_DETAILS';
};

type UpdateSectionVisibilityAction = {
  type: 'UPDATE_SECTION_VISIBILITY';
  sectionId: string;
  ratio: number;
};

export type IssueDetailsActions =
  | UpdateEventSectionAction
  | UpdateNavScrollMarginAction
  | UpdateEventCountAction
  | UpdateSidebarAction
  | UpdateDetectorDetailsAction
  | UpdateSectionVisibilityAction;

function updateEventSection(
  state: IssueDetailsState,
  sectionKey: SectionKey,
  updatedConfig: Partial<SectionConfig>
): IssueDetailsState {
  const existingConfig = state.sectionData[sectionKey] ?? {key: sectionKey};
  const nextState: IssueDetailsState = {
    ...state,
    sectionData: {
      ...state.sectionData,
      [sectionKey]: {...existingConfig, ...updatedConfig},
    },
  };
  return nextState;
}

/**
 * If trying to use the current state of the issue/event page, you likely want to use
 * `useIssueDetails` instead. This hook is just meant to create state for the provider.
 */
export function useIssueDetailsReducer() {
  const initialState: IssueDetailsState = {
    sectionData: {},
    detectorDetails: {},
    isSidebarOpen: true,
    eventCount: 0,
    navScrollMargin: 0,
    activeSection: null,
  };

  const reducer: Reducer<IssueDetailsState, IssueDetailsActions> = useCallback(
    (state, action): IssueDetailsState => {
      switch (action.type) {
        case 'UPDATE_SIDEBAR_STATE':
          return {...state, isSidebarOpen: action.isOpen};
        case 'UPDATE_NAV_SCROLL_MARGIN':
          return {...state, navScrollMargin: action.margin};
        case 'UPDATE_EVENT_SECTION':
          return updateEventSection(state, action.key, action.config ?? {});
        case 'UPDATE_EVENT_COUNT':
          return {...state, eventCount: action.count};
        case 'UPDATE_DETECTOR_DETAILS':
          return {...state, detectorDetails: action.detectorDetails};
        case 'UPDATE_SECTION_VISIBILITY':
          // When ratio is 1, it indicates this section should be active based on
          // its proximity to the activation offset
          return {
            ...state,
            activeSection: action.ratio === 1 ? action.sectionId : state.activeSection,
          };
        default:
          return state;
      }
    },
    []
  );

  const [issueDetails, dispatch] = useReducer(reducer, initialState);

  return {
    issueDetails,
    dispatch,
  };
}

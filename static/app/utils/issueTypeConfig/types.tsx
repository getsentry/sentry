import type {IssueType} from 'sentry/types/group';
import type {PlatformKey} from 'sentry/types/project';
import type {Tab} from 'sentry/views/issueDetails/types';

export type ResourceLink = {
  link: string;
  text: string;
};

type DisabledWithReasonConfig = {
  enabled: boolean;
  disabledReason?: string;
};

export type IssueTypeConfig = {
  /**
   * Enable/disable actions for an issue type
   */
  actions: {
    archiveUntilOccurrence: DisabledWithReasonConfig;
    delete: DisabledWithReasonConfig;
    deleteAndDiscard: DisabledWithReasonConfig;
    ignore: DisabledWithReasonConfig;
    merge: DisabledWithReasonConfig;
    resolve: DisabledWithReasonConfig;
    resolveInRelease: DisabledWithReasonConfig;
    share: DisabledWithReasonConfig;
  };
  /**
   * Should show Autofix for this issue type
   */
  autofix: boolean;
  /**
   * Custom copy for actions and other UI elements
   */
  customCopy: {
    eventUnits: string;
    resolution: string;
  };
  /**
   * Should show detector section in the sidebar
   * Optionally set a custom title for it
   */
  detector: DisabledWithReasonConfig & {
    ctaText?: string;
    title?: string;
  };
  /**
   * Is the "Open in Discover" button available for this issue
   */
  discover: DisabledWithReasonConfig;
  /**
   * Is the Event and User Counts shown for this issue
   */
  eventAndUserCounts: DisabledWithReasonConfig;
  /**
   * Options for rendering the Evidence section - pass null to disable
   */
  evidence: {
    title: string;
    helpText?: string;
  } | null;
  /**
   * Configuration for the issue-level information header
   */
  header: {
    filterBar: DisabledWithReasonConfig & {
      // Display the environment filter in an inactive, locked state
      fixedEnvironment?: boolean;
    };
    graph: DisabledWithReasonConfig & {
      type?: 'detector-history' | 'discover-events' | 'cron-checks' | 'uptime-checks';
    };
    occurrenceSummary: DisabledWithReasonConfig & {
      downtime?: boolean;
    };
    tagDistribution: DisabledWithReasonConfig;
  };
  /**
   * Is the Issue Summary available for this issue
   */
  issueSummary: DisabledWithReasonConfig;
  /**
   * Is the Log Level icon shown for this issue
   */
  logLevel: DisabledWithReasonConfig;
  /**
   * Is the Merged Issues tab shown for this issue
   */
  mergedIssues: DisabledWithReasonConfig;
  /**
   * Configuration for the event/occurrence content pages (formerly tabs)
   */
  pages: {
    /**
     * Is the Attachments page shown for this issue
     */
    attachments: DisabledWithReasonConfig;
    /**
     * Is the Check-Ins page shown for this issue
     */
    checkIns: DisabledWithReasonConfig;
    /**
     * Is the All Events/Occurrences page shown for this issue
     */
    events: DisabledWithReasonConfig;
    /**
     * The default page content to show for landing on this issue type
     */
    landingPage: Tab;
    /**
     * Is the Open periods page shown for this issue
     */
    openPeriods: DisabledWithReasonConfig;
    /**
     * Is the Replays page shown for this issue
     */
    replays: DisabledWithReasonConfig;
    /**
     * Is the Tags tab shown for this issue (legacy)
     */
    tagsTab: DisabledWithReasonConfig;
    /**
     * Is the User Feedback page shown for this issue
     */
    userFeedback: DisabledWithReasonConfig;
  };
  /**
   * Shows performance duration regression components
   */
  performanceDurationRegression: DisabledWithReasonConfig;
  /**
   * Shows profiling duration regression components
   */
  profilingDurationRegression: DisabledWithReasonConfig;
  /**
   * Enables various regression related supporting data for an issue type.
   */
  regression: DisabledWithReasonConfig;
  /**
   * If defined, will display a resources section for providing more information
   * about the given issue type
   */
  resources: {
    description: string | JSX.Element;
    /**
     * Resources to be shown for all platforms
     */
    links: ResourceLink[];
    /**
     * Platform-specific resource links
     */
    linksByPlatform: Partial<Record<PlatformKey, ResourceLink[]>>;
  } | null;
  /**
   * Should the page show the feedback widget
   */
  showFeedbackWidget: boolean;
  /**
   * Is the Similar Issues tab shown for this issue
   */
  similarIssues: DisabledWithReasonConfig;
  spanEvidence: DisabledWithReasonConfig;
  /**
   * Is the Stacktrace shown for this issue
   */
  stacktrace: DisabledWithReasonConfig;
  /**
   * Are group stats (counts/time series) shown for this issue.
   */
  stats: DisabledWithReasonConfig;
  /**
   * Are event tags or highlights shown for this issue
   */
  tags: DisabledWithReasonConfig;
  /**
   * Whether to use open periods for the last checked date
   */
  useOpenPeriodChecks: boolean;
  /**
   * Whether or not the issue type is using the issue platform
   */
  usesIssuePlatform: boolean;
};

export interface IssueCategoryConfigMapping
  extends Partial<Record<IssueType, Partial<IssueTypeConfig>>> {
  /**
   * Config options that apply to the entire issue category.
   * These options can be overridden by specific issue type configs.
   */
  _categoryDefaults: Partial<IssueTypeConfig>;
}

export const enum ErrorHelpType {
  CHUNK_LOAD_ERROR = 'chunk_load_error',
  DOCUMENT_OR_WINDOW_OBJECT_ERROR = 'document_or_window_object_error',
  HANDLE_HARD_NAVIGATE_ERROR = 'handle_hard_navigate_error',
  MODULE_NOT_FOUND = 'module_not_found',
  DYNAMIC_SERVER_USAGE = 'dynamic_server_usage',
  HYDRATION_ERROR = 'hydration_error',
  LOAD_FAILED = 'load_failed',
  SOCKET_HANG_UP = 'socket_hang_up',
  FAILED_TO_FETCH = 'failed_to_fetch',
  NEXTJS_ROUTER_NOT_MOUNTED = 'nextjs_router_not_mounted',
  UNBOUND_LOCAL_ERROR = 'unbound_local_error',
  NODEJS_CANNOT_FIND_MODULE = 'cannot_find_module',
  NO_MODULE_NAMED = 'no_module_named',
  STRINGS_ARE_IMMUTABLE = 'strings_are_immutable',
  INVARIANT_VIOLATION_ERROR = 'invariant_violation_error',
}

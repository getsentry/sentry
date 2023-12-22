import type {IssueType, PlatformKey} from 'sentry/types';

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
    resolveInRelease: DisabledWithReasonConfig;
    share: DisabledWithReasonConfig;
  };
  /**
   * Is the Attachments tab shown for this issue
   */
  attachments: DisabledWithReasonConfig;
  /**
   * Is the "Open in Discover" button available for this issue
   */
  discover: DisabledWithReasonConfig;
  /**
   * Is the Events tab show for this issue
   */
  events: DisabledWithReasonConfig;
  /**
   * Options for rendering the Evidence section - pass null to disable
   */
  evidence: {
    title: string;
    helpText?: string;
  } | null;
  /**
   * Is the Merged Issues tab shown for this issue
   */
  mergedIssues: DisabledWithReasonConfig;
  /**
   * Enables various regression related supporting data for an issue type.
   */
  regression: DisabledWithReasonConfig;
  /**
   * Is the Replays tab shown for this issue
   */
  replays: DisabledWithReasonConfig;
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
   * Is the Similar Issues tab shown for this issue
   */
  similarIssues: DisabledWithReasonConfig;
  /**
   * Are group stats (counts/time series) shown for this issue.
   */
  stats: DisabledWithReasonConfig;
  /**
   * Is the Tags tab show for this issue
   */
  tags: DisabledWithReasonConfig;
  /**
   * Is the User Feedback tab shown for this issue
   */
  userFeedback: DisabledWithReasonConfig;
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
  LOAD_FAILED = 'load_failed',
  SOCKET_HANG_UP = 'socket_hang_up',
}

export interface ErrorInfo {
  errorHelpType: ErrorHelpType;
  errorTitle: string;
  projectCheck: boolean;
}

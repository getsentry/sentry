import {IssueType, PlatformType} from 'sentry/types';

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
    delete: DisabledWithReasonConfig;
    deleteAndDiscard: DisabledWithReasonConfig;
    ignore: DisabledWithReasonConfig;
    merge: DisabledWithReasonConfig;
    share: DisabledWithReasonConfig;
  };
  /**
   * Is the Attachments tab shown for this issue
   */
  attachments: DisabledWithReasonConfig;
  /**
   * Options for rendering the Evidence section - pass null to disable
   */
  evidence: {
    title: string;
    helpText?: string;
  } | null;
  /**
   * Is the Grouping tab shown for this issue
   */
  grouping: DisabledWithReasonConfig;
  /**
   * Is the Merged Issues tab shown for this issue
   */
  mergedIssues: DisabledWithReasonConfig;
  /**
   * Is the Replays tab shown for this issue
   */
  replays: DisabledWithReasonConfig;
  /**
   * If defined, will display a resources section for providing more information
   * about the given issue type
   */
  resources: {
    description: string;
    /**
     * Resources to be shown for all platforms
     */
    links: ResourceLink[];
    /**
     * Platform-specific resource links
     */
    linksByPlatform: Partial<Record<PlatformType, ResourceLink[]>>;
  } | null;
  /**
   * Is the Similar Issues tab shown for this issue
   */
  similarIssues: DisabledWithReasonConfig;
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

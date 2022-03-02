import {Fuse} from 'sentry/utils/fuzzySearch';

/**
 * A result item that sources create.
 */
export type ResultItem = {
  /**
   * The type of result eg. settings, help-docs
   */
  resultType:
    | 'settings'
    | 'command'
    | 'route'
    | 'field'
    | 'issue'
    | 'event'
    | 'integration'
    | 'sentryApp'
    | 'docIntegration'
    | 'help-docs'
    | 'help-develop'
    | 'help-help-center'
    | 'help-blog';
  /**
   * The source that created the result.
   */
  sourceType:
    | 'organization'
    | 'project'
    | 'command'
    | 'team'
    | 'member'
    | 'field'
    | 'route'
    | 'event'
    | 'issue'
    | 'plugin'
    | 'integration'
    | 'sentryApp'
    | 'docIntegration'
    | 'help';
  /**
   * The title to display in result options.
   */
  title: React.ReactNode;
  /**
   * A handler to call when the result is clicked,
   * and the result doesn't have a URL.
   */
  action?: (item: ResultItem, autocompleteState: any) => void;
  configUrl?: string;
  /**
   * The description text to display
   */
  description?: React.ReactNode;

  disabled?: boolean;
  empty?: boolean;
  extra?: any;
  // Used to store groups and events
  model?: any;
  sectionCount?: number;
  sectionHeading?: string;
  /**
   * The path to visit when the result is clicked.
   */
  to?: string;
};

/**
 * Result with the source item and any highlighted text fragments that matched.
 */
export type Result = Fuse.FuseResult<ResultItem>;

/**
 * Common type send to child function
 * by search source components.
 */
export type ChildProps = {
  /**
   * Whether or not results have been loaded
   */
  isLoading: boolean;
  /**
   * Matched results
   */
  results: Result[];
};

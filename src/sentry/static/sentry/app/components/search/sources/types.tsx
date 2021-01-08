import parseHtmlMarks from 'app/utils/parseHtmlMarks';

type MarkedText = ReturnType<typeof parseHtmlMarks>;

/**
 * A result item that sources create.
 */
export type ResultItem = {
  /**
   * The title to display in result options.
   */
  title: React.ReactNode;
  /**
   * The source that created the result.
   */
  sourceType: string;
  /**
   * The type of result eg. settings, help-docs
   */
  resultType: string;
  /**
   * The description text to display
   */
  description?: React.ReactNode;
  /**
   * The path to visit when the result is clicked.
   */
  to?: string;
  /**
   * A handler to call when the result is clicked,
   * and the result doesn't have a URL.
   */
  action?: () => void;

  sectionHeading?: string;
  sectionCount?: number;
  extra?: any;
  empty?: boolean;
  // Used to store groups and events
  model?: any;
};

/**
 * Result with the source item and any highlighted text fragments that matched.
 */
export type Result = {
  item: ResultItem;
  matches?: MarkedText[];
};

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
  /**
   * All potential results if available.
   * @deprecated This isn't used by source consumers and will be removed soon.
   */
  allResults: Result[];
};

export enum Query {
  NEEDS_REVIEW = 'is:unresolved is:needs_review',
  UNRESOLVED = 'is:unresolved',
  IGNORED = 'is:ignored',
  REPROCESSING = 'is:reprocessing',
}

// These tabs will have the counts displayed
export const TabQueriesWithCounts = [Query.NEEDS_REVIEW, Query.UNRESOLVED, Query.IGNORED];

// the tab counts will look like 99+
export const TAB_MAX_COUNT = 99;

export type QueryCounts = {
  [Query.NEEDS_REVIEW]?: {
    count: number;
    hasMore: boolean;
  };
  [Query.UNRESOLVED]?: {
    count: number;
    hasMore: boolean;
  };
  [Query.IGNORED]?: {
    count: number;
    hasMore: boolean;
  };
};

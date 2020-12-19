export enum Query {
  NEEDS_REVIEW = 'is:needs_review is:unresolved',
  UNRESOLVED = 'is:unresolved',
  IGNORED = 'is:ignored',
  REPROCESSING = 'is:reprocessing',
}

export const TabQueriesWithCounts = [Query.NEEDS_REVIEW, Query.UNRESOLVED];

// These two tabs are the only two that will have the counts displayed currently
export type QueryCounts = {
  [Query.NEEDS_REVIEW]?: number,
  [Query.UNRESOLVED]?: number,
}

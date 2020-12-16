export enum Query {
  NEEDS_REVIEW = 'is:needs_review is:unresolved',
  UNRESOLVED = 'is:unresolved',
  IGNORED = 'is:ignored',
  REPROCESSING = 'is:reprocessing',
}

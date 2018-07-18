import Reflux from 'reflux';

// Actions for "Grouping" view - for merging/unmerging events/issues
let GroupingActions = Reflux.createActions([
  'fetch',
  'showAllSimilarItems',
  'toggleUnmerge',
  'toggleMerge',
  'unmerge',
  'merge',
  'toggleCollapseFingerprint',
  'toggleCollapseFingerprints',
]);
export default GroupingActions;

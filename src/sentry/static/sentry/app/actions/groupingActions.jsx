import Reflux from 'reflux';

// Actions for "Grouping" view - for merging/unmerging events/issues
let GroupingActions = Reflux.createActions([
  'fetch',
  'showAllSimilarItems',
  'toggleUnmerge',
  'toggleMerge',
  'unmerge',
  'merge',
  'expandFingerprints',
  'collapseFingerprints',
  'toggleCollapseFingerprint'
]);
export default GroupingActions;

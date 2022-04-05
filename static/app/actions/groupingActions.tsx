import {createActions} from 'reflux';

// Actions for "Grouping" view - for merging/unmerging events/issues
const GroupingActions = createActions([
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

import {createActions} from 'reflux';

// TODO(dcramer): we should probably just make every parameter update
// work on bulk groups
const GroupActions = createActions([
  'assignTo',
  'assignToError',
  'assignToSuccess',
  'delete',
  'deleteError',
  'deleteSuccess',
  'discard',
  'discardError',
  'discardSuccess',
  'update',
  'updateError',
  'updateSuccess',
  'merge',
  'mergeError',
  'mergeSuccess',
  'populateStats',
]);

export default GroupActions;

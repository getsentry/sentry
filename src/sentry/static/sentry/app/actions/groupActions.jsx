import Reflux from 'reflux';

// TODO(dcramer): we should probably just make every parameter update
// work on bulk groups
let GroupActions = Reflux.createActions([
  'addIssues',
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
  'load',
  'merge',
  'mergeError',
  'mergeSuccess',
  'reset',
]);

export default GroupActions;

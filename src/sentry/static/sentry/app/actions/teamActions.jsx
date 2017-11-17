import Reflux from 'reflux';

let TeamActions = Reflux.createActions([
  'update',
  'updateError',
  'updateSuccess',
  'fetchAll',
  'fetchAllSuccess',
  'fetchAllError',
  'fetchDetails',
  'fetchDetailsSuccess',
  'fetchDetailsError',
]);

export default TeamActions;

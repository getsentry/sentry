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
  'removeTeam',
  'removeTeamSuccess',
  'removeTeamError',
]);

export default TeamActions;

import Reflux from 'reflux';

const TeamActions = Reflux.createActions([
  'update',
  'updateError',
  'updateSuccess',
  'fetchAll',
  'fetchAllSuccess',
  'fetchAllError',
  'fetchDetails',
  'fetchDetailsSuccess',
  'fetchDetailsError',
  'createTeam',
  'createTeamSuccess',
  'createTeamError',
  'removeTeam',
  'removeTeamSuccess',
  'removeTeamError',
]);

export default TeamActions;

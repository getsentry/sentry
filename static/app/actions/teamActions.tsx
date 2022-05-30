import {createActions} from 'reflux';

const TeamActions = createActions([
  'createTeam',
  'createTeamError',
  'createTeamSuccess',
  'fetchAll',
  'fetchAllError',
  'fetchAllSuccess',
  'fetchDetails',
  'fetchDetailsError',
  'fetchDetailsSuccess',
  'loadTeams',
  'loadUserTeams',
  'removeTeam',
  'removeTeamError',
  'removeTeamSuccess',
  'reset',
  'update',
  'updateError',
  'updateSuccess',
]);

export default TeamActions;

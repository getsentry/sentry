import {createActions} from 'reflux';

const ProjectActions = createActions([
  'addTeam',
  'addTeamError',
  'addTeamSuccess',
  'changeSlug',
  'createSuccess',
  'loadProjects',
  'loadStats',
  'loadStatsError',
  'loadStatsForProjectSuccess',
  'loadStatsSuccess',
  'removeProject',
  'removeProjectError',
  'removeProjectSuccess',
  'removeTeam',
  'removeTeamError',
  'removeTeamSuccess',
  'reset',
  'setActive',
  'update',
  'updateError',
  'updateSuccess',
]);

export default ProjectActions;

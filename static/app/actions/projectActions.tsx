import 'sentry/stores/projectsStore';
import 'sentry/stores/projectsStatsStore';
import 'sentry/stores/latestContextStore';

import Reflux from 'reflux';

const ProjectActions = Reflux.createActions([
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

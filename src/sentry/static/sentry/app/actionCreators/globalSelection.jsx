/*eslint no-use-before-define: ["error", { "functions": false }]*/

import {isInteger} from 'lodash';
import GlobalSelectionActions from 'app/actions/globalSelectionActions';

/**
 * Updates global project selection
 *
 * @param {Number[]} projects List of project ids
 */
export function updateProjects(projects) {
  if (!isProjectsValid(projects)) {
    return;
  }

  GlobalSelectionActions.updateProjects(projects);
}

function isProjectsValid(projects) {
  return Array.isArray(projects) && projects.every(project => isInteger(project));
}

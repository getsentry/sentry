/*eslint no-use-before-define: ["error", { "functions": false }]*/

import * as Sentry from '@sentry/browser';
import {isInteger} from 'lodash';
import GlobalSelectionActions from 'app/actions/globalSelectionActions';

/**
 * Updates global project selection
 *
 * @param {Number[]} projects List of project ids
 */
export function updateProjects(projects) {
  if (!isProjectsValid(projects)) {
    Sentry.withScope(scope => {
      scope.setExtra('projects', projects);
      Sentry.captureException(new Error('Invalid projects selected'));
    });
    return;
  }

  GlobalSelectionActions.updateProjects(projects);
}

function isProjectsValid(projects) {
  return Array.isArray(projects) && projects.every(project => isInteger(project));
}

/**
 * Updates datetime selection
 *
 * @param {Object} datetime Object with start, end, range keys
 */
export function updateDateTime(datetime) {
  GlobalSelectionActions.updateDateTime(datetime);
}

/**
 * Updates global environment selection
 *
 * @param {String[]} environments List of environments
 */
export function updateEnvironments(environments) {
  GlobalSelectionActions.updateEnvironments(environments);
}

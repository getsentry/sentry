import {backend, replayPlatforms} from 'sentry/data/platformCategories';
import type {MinimalProject} from 'sentry/types';

/**
 * Are you able to send a Replay into the project?
 *
 * Basically: is this a frontend project
 */
function projectSupportsReplay(project: MinimalProject) {
  return Boolean(project.platform && replayPlatforms.includes(project.platform));
}

/**
 * Can this project be related to a Replay?
 *
 * Basically: is this a backend or frontend project
 */
export function projectCanLinkToReplay(project: undefined | MinimalProject) {
  if (!project) {
    return false;
  }
  const {platform} = project;
  return Boolean(
    platform &&
      replayPlatforms.includes(platform) &&
      backend.some(val => val === platform) // TS doesn't like `includes()` here :(
  );
}

export default projectSupportsReplay;

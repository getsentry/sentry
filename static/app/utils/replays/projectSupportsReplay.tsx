import {backend, replayPlatforms} from 'sentry/data/platformCategories';
import type {Organization} from 'sentry/types/organization';
import type {MinimalProject} from 'sentry/types/project';

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
export function projectCanLinkToReplay(
  _organization: Organization,
  project: undefined | MinimalProject
) {
  if (!project || !project.platform) {
    return false;
  }
  const supportedPlatforms = replayPlatforms;

  return (
    supportedPlatforms.includes(project.platform) || backend.includes(project.platform)
  );
}

export function projectCanUpsellReplay(project: undefined | MinimalProject) {
  if (!project || !project.platform) {
    return false;
  }
  return replayPlatforms.includes(project.platform);
}

export default projectSupportsReplay;

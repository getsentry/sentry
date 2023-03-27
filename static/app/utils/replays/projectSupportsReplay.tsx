import {replayPlatforms} from 'sentry/data/platformCategories';
import type {MinimalProject} from 'sentry/types';

function projectSupportsReplay(project: MinimalProject) {
  return Boolean(project.platform && replayPlatforms.includes(project.platform));
}

export default projectSupportsReplay;

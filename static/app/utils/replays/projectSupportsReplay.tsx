import {replayPlatforms} from 'sentry/data/platformCategories';
import type {AvatarProject, MinimalProject} from 'sentry/types';

function projectSupportsReplay(project?: MinimalProject | AvatarProject) {
  return Boolean(project?.platform && replayPlatforms.includes(project.platform));
}

export default projectSupportsReplay;

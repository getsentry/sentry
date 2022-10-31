import type {MinimalProject} from 'sentry/types';

function projectSupportsReplay(project?: MinimalProject) {
  return Boolean(project?.platform?.includes('javascript'));
}

export default projectSupportsReplay;

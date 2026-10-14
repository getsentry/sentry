import type {Repository} from 'sentry/types/integrations';
import {slugify} from 'sentry/utils/slugify';

const MAX_PROJECT_NAME_LENGTH = 50;

interface Options {
  platformKey: string | undefined;
  repository: Repository | undefined;
}

/**
 * Returns the default project name for a new SCM project.
 *
 * Prefers the last path segment of the selected repository name
 * (e.g. "getsentry/sentry" → "sentry"), falling back to the platform key
 * when no repository is selected.
 */
export function getScmDefaultProjectName({repository, platformKey}: Options): string {
  const repoSegment = slugify(repository?.name.split('/').pop() ?? '');
  const base = repoSegment.length > 0 ? repoSegment : slugify(platformKey ?? '');
  return base.slice(0, MAX_PROJECT_NAME_LENGTH);
}

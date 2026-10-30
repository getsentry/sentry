import {RESERVED_PROJECT_SLUGS} from 'sentry/constants';
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
 * Prefers the last non-empty path segment of the selected repository name,
 * falling back to the platform key when no repository is selected or the
 * repo-derived name is a reserved slug.
 *
 * Repository name formats vary by provider:
 *   - GitHub / Bitbucket / Cursor Origin: "owner/repo"
 *   - Bitbucket Server:                  "PROJECT_KEY/slug"
 *   - GitLab (name_with_namespace):      "Group / Subgroup / Repo" (spaces around "/")
 *   - Azure DevOps:                      bare repo name, no slash
 *   - Perforce:                          "//depot" or "//depot/project"
 *
 * Segments are trimmed and empty ones skipped to handle GitLab's spaced
 * separator, Perforce's leading "//", and trailing slashes.
 */
export function getScmDefaultProjectName({repository, platformKey}: Options): string {
  const lastSegment =
    repository?.name
      .split('/')
      .map(segment => segment.trim())
      .findLast(Boolean) ?? '';
  const repoName = toProjectName(lastSegment);
  if (repoName && !RESERVED_PROJECT_SLUGS.has(repoName)) {
    return repoName;
  }
  return toProjectName(platformKey ?? '');
}

// Mirrors the backend's slugify_instance, which strips edge hyphens after truncating.
function toProjectName(value: string): string {
  return slugify(value)
    .slice(0, MAX_PROJECT_NAME_LENGTH)
    .replace(/^-+|-+$/g, '');
}

import partition from 'lodash/partition';

import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';

import {sortProjectsByBookmarkAndMembership} from './sortProjects';

interface ProjectMembershipGroup {
  key: 'my-projects' | 'other-projects';
  label: string;
  projects: Project[];
}

/**
 * Groups projects into "My Projects" and "Other Projects", each sorted by
 * bookmark, then slug. Empty groups are left out.
 *
 * Pass `bookmarkedIds` to sort by a fixed set of bookmarks, see
 * `sortProjectsByBookmarkAndMembership`.
 */
export function groupProjectsByMembership(
  projects: readonly Project[],
  bookmarkedIds?: ReadonlySet<string>
): ProjectMembershipGroup[] {
  const [myProjects, otherProjects] = partition(
    sortProjectsByBookmarkAndMembership(projects, bookmarkedIds),
    project => project.isMember
  );

  return [
    {key: 'my-projects' as const, label: t('My Projects'), projects: myProjects},
    {key: 'other-projects' as const, label: t('Other Projects'), projects: otherProjects},
  ].filter(group => group.projects.length > 0);
}

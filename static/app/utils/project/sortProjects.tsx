type SortableProject = {
  isBookmarked: boolean;
  slug: string;
};

function projectDisplayCompare(a: SortableProject, b: SortableProject): number {
  if (a.isBookmarked !== b.isBookmarked) {
    return a.isBookmarked ? -1 : 1;
  }
  return a.slug.localeCompare(b.slug);
}

/**
 * Sort a list of projects by bookmarkedness, then by slug
 */
export function sortProjects<T extends SortableProject>(projects: readonly T[]): T[] {
  return projects.toSorted(projectDisplayCompare);
}

type PageFilterSortableProject = SortableProject & {
  id: string;
  isMember: boolean;
};

/**
 * Sort projects the way the project page filter lists them: bookmarked
 * projects first, then projects the user is a member of, each group by slug.
 *
 * Pass `bookmarkedIds` to sort by a snapshot of bookmarks instead of each
 * project's live `isBookmarked`, so an open menu keeps its order while the
 * user toggles stars in it.
 */
export function sortProjectsByBookmarkAndMembership<T extends PageFilterSortableProject>(
  projects: readonly T[],
  bookmarkedIds?: ReadonlySet<string>
): T[] {
  const isBookmarked = (project: T) =>
    bookmarkedIds ? bookmarkedIds.has(project.id) : project.isBookmarked;

  return projects.toSorted((a, b) => {
    if (isBookmarked(a) !== isBookmarked(b)) {
      return isBookmarked(a) ? -1 : 1;
    }
    if (a.isMember !== b.isMember) {
      return a.isMember ? -1 : 1;
    }
    return a.slug.localeCompare(b.slug);
  });
}

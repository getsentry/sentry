type SortableProject = {
  isBookmarked: boolean;
  slug: string;
};

// Natural order, so `project-2` comes before `project-10`.
const compareSlugs = new Intl.Collator(undefined, {numeric: true}).compare;

function projectDisplayCompare(a: SortableProject, b: SortableProject): number {
  if (a.isBookmarked !== b.isBookmarked) {
    return a.isBookmarked ? -1 : 1;
  }
  return compareSlugs(a.slug, b.slug);
}

/**
 * Sort a list of projects by bookmarkedness, then by slug
 */
export function sortProjects<T extends SortableProject>(projects: readonly T[]): T[] {
  return projects.toSorted(projectDisplayCompare);
}

type MemberSortableProject = SortableProject & {
  id: string;
  isMember: boolean;
};

/**
 * Sort projects by bookmark, then membership, then slug.
 *
 * Pass `bookmarkedIds` to sort by a fixed set of bookmarks instead of each
 * project's current `isBookmarked`, so the order holds while bookmarks change.
 */
export function sortProjectsByBookmarkAndMembership<T extends MemberSortableProject>(
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
    return compareSlugs(a.slug, b.slug);
  });
}

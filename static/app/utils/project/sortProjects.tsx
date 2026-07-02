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

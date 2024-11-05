import type {Project} from 'sentry/types/project';

function projectDisplayCompare(a: Project, b: Project): number {
  if (a.isBookmarked !== b.isBookmarked) {
    return a.isBookmarked ? -1 : 1;
  }
  return a.slug.localeCompare(b.slug);
}

/**
 * Sort a list of projects by bookmarkedness, then by id
 */
export function sortProjects(projects: Readonly<Array<Project>>): Array<Project> {
  return projects.toSorted(projectDisplayCompare);
}

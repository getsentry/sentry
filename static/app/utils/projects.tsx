import {Fragment} from 'react';

import {AvatarProject, Project} from 'app/types';
import useProjects from 'app/utils/useProjects';

type ProjectPlaceholder = AvatarProject;

type HookOptions = NonNullable<Parameters<typeof useProjects>[0]>;
type HookReturn = ReturnType<typeof useProjects>;

type RenderProps = Pick<
  HookReturn,
  'fetching' | 'hasMore' | 'initiallyLoaded' | 'fetchError'
> & {
  /**
   * We want to make sure that at the minimum, we return a list of objects with only `slug`
   * while we load actual project data
   */
  projects: Project[] | ProjectPlaceholder[];

  /**
   * Calls API and searches for project, accepts a callback function with signature:
   * fn(searchTerm, {append: bool})
   */
  onSearch: (searchTerm: string, {append: boolean}) => void;
};

type RenderFunc = (props: RenderProps) => React.ReactNode;

type Props = Pick<HookOptions, 'orgId' | 'slugs' | 'limit'> & {
  children: RenderFunc;
  /**
   * Whether to fetch all the projects in the organization of which the user
   * has access to
   */
  allProjects?: boolean;
  /**
   * If slugs is passed, forward placeholder objects with slugs while fetching
   */
  passthroughPlaceholderProject?: boolean;
};

/**
 * This is a utility component that should be used to fetch an organization's projects (summary).
 * It can either fetch explicit projects (e.g. via slug) or a paginated list of projects.
 * These will be passed down to the render prop (`children`).
 *
 * The legacy way of handling this is that `ProjectSummary[]` is expected to be included in an
 * `Organization` as well as being saved to `ProjectsStore`.
 */
function Projects({
  children,
  slugs,
  limit,
  orgId,
  allProjects: _allProjects,
  passthroughPlaceholderProject = true,
}: Props) {
  const {projects, placeholders, ...result} = useProjects({slugs, limit, orgId});

  const renderProps = {
    // We want to make sure that at the minimum, we return a list of objects
    // with only `slug` while we load actual project data
    projects: passthroughPlaceholderProject
      ? [...projects, ...placeholders].sort((a, b) => a.slug.localeCompare(b.slug))
      : projects,
    ...result,
  };

  return <Fragment>{children(renderProps)}</Fragment>;
}

export default Projects;

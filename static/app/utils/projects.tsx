import {Fragment} from 'react';

import useProjects from 'app/utils/useProjects';

export type RenderProps = ReturnType<typeof useProjects>;

type Props = Parameters<typeof useProjects>[0] & {
  children: (props: RenderProps) => React.ReactNode;
};

/**
 * This is a utility component that should be used to fetch an organization's projects (summary).
 * It can either fetch explicit projects (e.g. via slug) or a paginated list of projects.
 * These will be passed down to the render prop (`children`).
 *
 * The legacy way of handling this is that `ProjectSummary[]` is expected to be included in an
 * `Organization` as well as being saved to `ProjectsStore`.
 */
function Projects({children, ...props}: Props) {
  const renderProps = useProjects(props);

  return <Fragment>{children(renderProps)}</Fragment>;
}

export default Projects;

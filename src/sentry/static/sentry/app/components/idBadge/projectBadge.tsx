import * as React from 'react';

import BaseBadge from 'app/components/idBadge/baseBadge';
import BadgeDisplayName from 'app/components/idBadge/badgeDisplayName';

type BaseBadgeProps = React.ComponentProps<typeof BaseBadge>;
type Project = NonNullable<BaseBadgeProps['project']>;

type Props = Partial<Omit<BaseBadgeProps, 'project' | 'organization' | 'team'>> & {
  project: Project;
  /**
   * If true, will use default max-width, or specify one as a string
   */
  hideOverflow?: boolean | string;
};

const ProjectBadge = ({hideOverflow = true, project, ...props}: Props) => (
  <BaseBadge
    displayName={
      <BadgeDisplayName hideOverflow={hideOverflow}>{project.slug}</BadgeDisplayName>
    }
    project={project}
    {...props}
  />
);

export default ProjectBadge;

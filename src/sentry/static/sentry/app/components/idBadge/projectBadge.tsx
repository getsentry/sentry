import React from 'react';
import PropTypes from 'prop-types';

import {AvatarProject} from 'app/types';
import BaseBadge from 'app/components/idBadge/baseBadge';
import BadgeDisplayName from 'app/components/idBadge/badgeDisplayName';

type Props = {
  project: AvatarProject;
  avatarSize?: number;
  className?: string;
  hideOverflow?: boolean | string;
  // Inherited from BaseBadge
  hideAvatar?: boolean;
  displayName?: React.ReactNode;
  description?: React.ReactNode;
  hideName?: boolean;
  avatarClassName?: string;
};

function ProjectBadge({
  hideOverflow = true,
  hideAvatar = false,
  project,
  ...props
}: Props) {
  return (
    <BaseBadge
      displayName={
        <BadgeDisplayName hideOverflow={hideOverflow}>{project.slug}</BadgeDisplayName>
      }
      project={project}
      hideAvatar={hideAvatar}
      {...props}
    />
  );
}

ProjectBadge.propTypes = {
  ...BaseBadge.propTypes,
  project: BaseBadge.propTypes.project.isRequired,
  avatarSize: PropTypes.number,
  /**
   * If true, will use default max-width, or specify one as a string
   */
  hideOverflow: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  hideAvatar: PropTypes.bool,
};

export default ProjectBadge;

import React from 'react';
import PropTypes from 'prop-types';

import BaseBadge from 'app/components/idBadge/baseBadge';
import BadgeDisplayName from 'app/components/idBadge/badgeDisplayName';
import {Project} from 'app/types';

type Props = {
  project: Project;
  avatarSize: number;
  className?: string;
  hideAvatar?: boolean;
  hideName?: boolean;
  description?: React.ReactNode;
  avatarClassName?: string | React.CSSProperties;
  // If true, will use default max-width, or specify one as a string
  hideOverflow?: boolean | string;
};

export default class ProjectBadge extends React.PureComponent<Props> {
  static propTypes = {
    ...BaseBadge.propTypes,
    project: BaseBadge.propTypes.project.isRequired,
    avatarSize: PropTypes.number,
    hideOverflow: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    hideAvatar: PropTypes.bool,
  };

  static defaultProps = {
    hideAvatar: false,
    hideOverflow: true,
  };

  render() {
    const {hideOverflow, project, ...props} = this.props;

    return (
      <BaseBadge
        displayName={
          <BadgeDisplayName hideOverflow={hideOverflow}>{project.slug}</BadgeDisplayName>
        }
        project={project}
        {...props}
      />
    );
  }
}

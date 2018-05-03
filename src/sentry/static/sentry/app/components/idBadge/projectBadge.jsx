import React from 'react';
import PropTypes from 'prop-types';

import BaseBadge from 'app/components/idBadge/baseBadge';
import SentryTypes from 'app/proptypes';
import BadgeDisplayName from 'app/components/idBadge/badgeDisplayName';

export default class ProjectBadge extends React.Component {
  static propTypes = {
    ...BaseBadge.propTypes,
    project: SentryTypes.Project.isRequired,
    avatarSize: PropTypes.number,
    /**
     * If true, will use default max-width, or specify one as a string
     */
    hideOverflow: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    hideAvatar: PropTypes.bool,
  };

  static defaultProps = {
    hideAvatar: true,
    hideOverflow: true,
  };

  render() {
    let {hideOverflow, project, ...props} = this.props;

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

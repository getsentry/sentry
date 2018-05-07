import React from 'react';
import PropTypes from 'prop-types';

import BaseBadge from 'app/components/idBadge/baseBadge';
import SentryTypes from 'app/proptypes';
import BadgeDisplayName from 'app/components/idBadge/badgeDisplayName';

export default class OrganizationBadge extends React.Component {
  static propTypes = {
    ...BaseBadge.propTypes,
    organization: SentryTypes.Organization.isRequired,
    avatarSize: PropTypes.number,
    /**
     * If true, will use default max-width, or specify one as a string
     */
    hideOverflow: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    hideAvatar: PropTypes.bool,
  };

  static defaultProps = {
    avatarSize: 24,
    hideAvatar: false,
    hideOverflow: true,
  };

  render() {
    let {hideOverflow, organization, ...props} = this.props;

    return (
      <BaseBadge
        displayName={
          <BadgeDisplayName hideOverflow={hideOverflow}>
            {organization.slug}
          </BadgeDisplayName>
        }
        organization={organization}
        {...props}
      />
    );
  }
}

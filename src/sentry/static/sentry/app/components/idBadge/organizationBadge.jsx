import React from 'react';
import PropTypes from 'prop-types';

import BaseBadge from 'app/components/idBadge/baseBadge';
import SentryTypes from 'app/proptypes';
import SlugOverflow from 'app/components/idBadge/slugOverflow';

export default class OrganizationBadge extends React.Component {
  static propTypes = {
    ...BaseBadge.propTypes,
    organization: SentryTypes.Organization.isRequired,
    avatarSize: PropTypes.number,
    hideAvatar: PropTypes.bool,
  };

  static defaultProps = {
    avatarSize: 24,
    hideAvatar: false,
  };

  render() {
    let {organization} = this.props;

    return (
      <BaseBadge
        displayName={<SlugOverflow>{organization.slug}</SlugOverflow>}
        {...this.props}
      />
    );
  }
}

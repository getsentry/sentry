import PropTypes from 'prop-types';
import React from 'react';

import BaseBadge from 'app/components/idBadge/baseBadge';
import BadgeDisplayName from 'app/components/idBadge/badgeDisplayName';
import SentryTypes from 'app/sentryTypes';
import {Organization} from 'app/types';
import OrganizationAvatar from 'app/components/avatar/organizationAvatar';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  // A full organization is not used, but required to satisfy types with
  // withOrganization()
  organization: Organization;
  className?: string;
  avatarSize?: OrganizationAvatar['props']['size'];
  // If true, will use default max-width, or specify one as a string
  hideOverflow?: boolean | string;
  hideAvatar?: boolean;
};

class OrganizationBadge extends React.Component<Props> {
  static propTypes = {
    ...BaseBadge.propTypes,
    organization: SentryTypes.Organization.isRequired,
    avatarSize: PropTypes.number,
    hideOverflow: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    hideAvatar: PropTypes.bool,
  };

  static defaultProps: Partial<Props> = {
    avatarSize: 24,
    hideAvatar: false,
    hideOverflow: true,
  };

  render() {
    const {hideOverflow, organization, ...props} = this.props;

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

export default withOrganization(OrganizationBadge);

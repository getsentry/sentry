import {isEqual} from 'lodash';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';

import BaseBadge from 'app/components/idBadge/baseBadge';
import BadgeDisplayName from 'app/components/idBadge/badgeDisplayName';
import OrganizationStore from 'app/stores/organizationsStore';
import SentryTypes from 'app/proptypes';

class OrganizationBadge extends React.Component {
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

const OrganizationBadgeContainer = createReactClass({
  displayName: 'OrganizationBadgeContainer',
  propTypes: {
    organization: SentryTypes.Organization.isRequired,
  },
  mixins: [Reflux.listenTo(OrganizationStore, 'onOrganizationStoreUpdate')],
  getInitialState() {
    return {
      organization: this.props.organization,
    };
  },

  componentWillReceiveProps(nextProps) {
    if (this.state.organization === nextProps.organization) return;
    if (isEqual(this.state.organization, nextProps.organization)) return;

    this.setState({
      organization: nextProps.organization,
    });
  },

  onOrganizationStoreUpdate() {
    let org = OrganizationStore.get(this.state.organization.slug);
    if (isEqual(org.avatar, this.state.organization.avatar)) return;

    this.setState({
      organization: OrganizationStore.get(this.state.organization.slug),
    });
  },

  render() {
    return <OrganizationBadge {...this.props} organization={this.state.organization} />;
  },
});
export default OrganizationBadgeContainer;

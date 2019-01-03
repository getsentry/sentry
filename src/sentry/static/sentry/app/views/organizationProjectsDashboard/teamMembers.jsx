import React from 'react';
import PropTypes from 'prop-types';

import AsyncComponent from 'app/components/asyncComponent';
import AvatarList from 'app/components/avatar/avatarList';

export default class TeamMembers extends AsyncComponent {
  static propTypes = {
    teamId: PropTypes.string.isRequired,
    orgId: PropTypes.string.isRequired,
  };

  getEndpoints() {
    const {orgId, teamId} = this.props;
    return [['members', `/teams/${orgId}/${teamId}/members/`]];
  }

  renderLoading() {
    return null;
  }

  renderBody() {
    if (this.state.members) {
      const users = this.state.members.filter(({user}) => !!user).map(({user}) => user);
      return <AvatarList users={users} />;
    }
    return null;
  }
}

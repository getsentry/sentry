import React from 'react';
import PropTypes from 'prop-types';

import AsyncComponent from '../../components/asyncComponent';
import AvatarList from '../../components/avatar/avatarList';

export default class TeamMembers extends AsyncComponent {
  static propTypes = {
    teamId: PropTypes.string.isRequired,
    orgId: PropTypes.string.isRequired,
  };

  getEndpoints() {
    const {orgId, teamId} = this.props;
    return [['members', `/teams/${orgId}/${teamId}/members/`]];
  }

  renderBody() {
    if (this.state.members) {
      const users = this.state.members.map(member => member.user);
      return <AvatarList users={users} />;
    }
    return null;
  }
}

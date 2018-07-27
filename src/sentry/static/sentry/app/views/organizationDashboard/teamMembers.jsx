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
    const {members} = this.state;
    if (!members || !Array.isArray(members)) return null;

    const users = members.filter(({user}) => !!user).map(({user}) => user);
    return <AvatarList users={users} />;
  }
}

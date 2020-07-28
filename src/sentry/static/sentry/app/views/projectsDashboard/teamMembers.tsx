import React from 'react';
import PropTypes from 'prop-types';

import {Member} from 'app/types';
import AsyncComponent from 'app/components/asyncComponent';
import AvatarList from 'app/components/avatar/avatarList';

type Props = AsyncComponent['props'] & {
  teamId: string;
  orgId: string;
};

type State = AsyncComponent['state'] & {
  members?: Member[];
};

class TeamMembers extends AsyncComponent<Props, State> {
  static propTypes = {
    teamId: PropTypes.string.isRequired,
    orgId: PropTypes.string.isRequired,
  };

  getEndpoints(): Array<[string, string]> {
    const {orgId, teamId} = this.props;
    return [['members', `/teams/${orgId}/${teamId}/members/`]];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody(): React.ReactNode {
    const {members} = this.state;
    if (!members) {
      return null;
    }

    const users = members.filter(({user}) => !!user).map(({user}) => user);
    return <AvatarList users={users} />;
  }
}

export default TeamMembers;

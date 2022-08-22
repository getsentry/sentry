import AsyncComponent from 'sentry/components/asyncComponent';
import AvatarList from 'sentry/components/avatar/avatarList';
import {Member} from 'sentry/types';

type Props = AsyncComponent['props'] & {
  orgId: string;
  teamId: string;
};

type State = AsyncComponent['state'] & {
  members?: Member[];
};

class TeamMembers extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
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

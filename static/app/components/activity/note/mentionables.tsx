import {PureComponent} from 'react';
import uniqBy from 'lodash/uniqBy';

import MemberListStore from 'sentry/stores/memberListStore';
import {Organization, Project, User} from 'sentry/types';
import {callIfFunction} from 'sentry/utils/callIfFunction';
import {isRenderFunc} from 'sentry/utils/isRenderFunc';
import Projects from 'sentry/utils/projects';
import withOrganization from 'sentry/utils/withOrganization';

import {Mentionable} from './types';

const buildUserId = (id: string) => `user:${id}`;
const buildTeamId = (id: string) => `team:${id}`;

type ChildFuncProps = {
  members: Mentionable[];
  teams: Mentionable[];
};

type Props = {
  children: (props: ChildFuncProps) => React.ReactNode;
  me: User;
  organization: Organization;
  projectSlugs: string[];
};

type State = {
  members: User[];
};

/**
 * Make sure the actionCreator, `fetchOrgMembers`, has been called somewhere
 * higher up the component chain.
 *
 * Will provide a list of users and teams that can be used for @-mentions
 * */
class Mentionables extends PureComponent<Props, State> {
  state: State = {
    members: MemberListStore.getAll(),
  };

  componentWillUnmount() {
    this.listeners.forEach(callIfFunction);
  }

  listeners = [
    MemberListStore.listen((users: User[]) => {
      this.handleMemberListUpdate(users);
    }, undefined),
  ];

  handleMemberListUpdate = (members: User[]) => {
    if (members === this.state.members) {
      return;
    }

    this.setState({
      members,
    });
  };

  getMemberList(memberList: User[], sessionUser: User): Mentionable[] {
    const members = uniqBy(memberList, ({id}) => id).filter(
      ({id}) => !sessionUser || sessionUser.id !== id
    );
    return members.map(member => ({
      id: buildUserId(member.id),
      display: member.name,
      email: member.email,
    }));
  }

  getTeams(projects: Project[]): Mentionable[] {
    const uniqueTeams = uniqBy(
      projects
        .map(({teams}) => teams)
        .reduce((acc, teams) => acc.concat(teams || []), []),
      'id'
    );

    return uniqueTeams.map(team => ({
      id: buildTeamId(team.id),
      display: `#${team.slug}`,
      email: team.id,
    }));
  }

  renderChildren = ({projects}) => {
    const {children, me} = this.props;
    if (isRenderFunc<ChildFuncProps>(children)) {
      return children({
        members: this.getMemberList(this.state.members, me),
        teams: this.getTeams(projects),
      });
    }
    return null;
  };

  render() {
    const {organization, projectSlugs} = this.props;

    if (!projectSlugs || !projectSlugs.length) {
      return this.renderChildren({projects: []});
    }

    return (
      <Projects slugs={projectSlugs} orgId={organization.slug}>
        {this.renderChildren}
      </Projects>
    );
  }
}

export default withOrganization(Mentionables);

import uniqBy from 'lodash/uniqBy';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';

import MemberListStore from 'app/stores/memberListStore';
import Projects from 'app/utils/projects';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

const buildUserId = id => `user:${id}`;
const buildTeamId = id => `team:${id}`;

/**
 * Make sure the actionCreator, `fetchOrgMembers`, has been called somewhere
 * higher up the component chain.
 *
 * Will provide a list of users and teams that can be used for @-mentions
 * */
class Mentionables extends React.PureComponent {
  static propTypes = {
    me: SentryTypes.User,
    organization: SentryTypes.Organization.isRequired,
    projectSlugs: PropTypes.arrayOf(PropTypes.string),
  };

  state = {
    members: MemberListStore.getAll(),
  };

  componentDidMount() {
    this.membersStoreMixin = Reflux.listenTo(
      MemberListStore,
      this.handleMemberListUpdate
    );
    this.membersStoreMixin.componentDidMount();
  }

  componentWillUnmount() {
    this.membersStoreMixin.componentWillUnmount();
  }

  handleMemberListUpdate = members => {
    if (members === this.state.members) {
      return;
    }

    this.setState({
      members,
    });
  };

  getMemberList = (memberList, sessionUser) => {
    const members = uniqBy(memberList, ({id}) => id).filter(
      ({id}) => !sessionUser || sessionUser.id !== id
    );
    return members.map(member => ({
      id: buildUserId(member.id),
      display: member.name,
      email: member.email,
    }));
  };

  getTeams = projects => {
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
  };

  renderChildren = ({projects}) => {
    const {children, me} = this.props;
    return children({
      members: this.getMemberList(this.state.members, me),
      teams: this.getTeams(projects),
    });
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

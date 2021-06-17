import * as React from 'react';
import assign from 'lodash/assign';

import MemberListStore from 'app/stores/memberListStore';
import TagStore from 'app/stores/tagStore';
import TeamStore from 'app/stores/teamStore';
import {TagCollection, Team, User} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';

type InjectedTagsProps = {
  tags: TagCollection;
};

type State = {
  tags: TagCollection;
  users: User[];
  teams: Team[];
};

const uuidPattern = /[0-9a-f]{32}$/;
const getUsername = ({isManaged, username, email}: User) => {
  // Users created via SAML receive unique UUID usernames. Use
  // their email in these cases, instead.
  if (username && uuidPattern.test(username)) {
    return email;
  } else {
    return !isManaged && username ? username : email;
  }
};

/**
 * HOC for getting tags and many useful issue attributes as 'tags' for use
 * in autocomplete selectors or condition builders.
 */
function withIssueTags<P extends InjectedTagsProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithIssueTags extends React.Component<P, State> {
    static displayName = `withIssueTags(${getDisplayName(WrappedComponent)})`;

    constructor(props, context) {
      super(props, context);

      const tags = assign(
        {},
        TagStore.getAllTags(),
        TagStore.getIssueAttributes(),
        TagStore.getBuiltInTags()
      );
      const users = MemberListStore.getAll();
      const teams = TeamStore.getAll();

      this.state = {tags, users, teams};
    }

    componentWillUnmount() {
      this.unsubscribeMembers();
      this.unsubscribeTeams();
      this.unsubscribeTags();
    }

    unsubscribeMembers = MemberListStore.listen((users: User[]) => {
      this.setState({users});
      this.setAssigned();
    }, undefined);

    unsubscribeTeams = TeamStore.listen(() => {
      this.setState({teams: TeamStore.getAll()});
      this.setAssigned();
    }, undefined);

    unsubscribeTags = TagStore.listen((storeTags: TagCollection) => {
      const tags = assign(
        {},
        storeTags,
        TagStore.getIssueAttributes(),
        TagStore.getBuiltInTags()
      );
      this.setState({tags});
      this.setAssigned();
    }, undefined);

    setAssigned() {
      const {tags, users, teams} = this.state;
      const usernames: string[] = users.map(getUsername);
      const teamnames: string[] = teams
        .filter(team => team.isMember)
        .map(team => `#${team.slug}`);
      const allAssigned = ['[me, none]', ...usernames.concat(teamnames)];
      allAssigned.unshift('me');
      usernames.unshift('me');

      this.setState({
        tags: {
          ...tags,
          assigned: {
            ...tags.assigned,
            values: allAssigned,
          },
          bookmarks: {
            ...tags.bookmarks,
            values: usernames,
          },
          assigned_or_suggested: {
            ...tags.assigned_or_suggested,
            values: allAssigned,
          },
        },
      });
    }

    render() {
      const {tags, ...props} = this.props as P;
      return <WrappedComponent {...({tags: tags ?? this.state.tags, ...props} as P)} />;
    }
  }

  return WithIssueTags;
}

export default withIssueTags;

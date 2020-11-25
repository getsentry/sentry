import React from 'react';
import createReactClass from 'create-react-class';
import assign from 'lodash/assign';
import Reflux from 'reflux';

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
const withIssueTags = <P extends InjectedTagsProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass<Omit<P, keyof InjectedTagsProps>, State>({
    displayName: `withIssueTags(${getDisplayName(WrappedComponent)})`,

    mixins: [
      Reflux.listenTo(MemberListStore, 'onMemberListStoreChange') as any,
      Reflux.listenTo(TeamStore, 'onTeamStoreChange') as any,
      Reflux.listenTo(TagStore, 'onTagsUpdate') as any,
    ],

    getInitialState() {
      const tags = assign(
        {},
        TagStore.getAllTags(),
        TagStore.getIssueAttributes(),
        TagStore.getBuiltInTags()
      );
      const users = MemberListStore.getAll();
      const teams = TeamStore.getAll();

      return {tags, users, teams};
    },

    onMemberListStoreChange(users: User[]) {
      this.setState({users});
      this.setAssigned();
    },

    onTeamStoreChange() {
      this.setState({teams: TeamStore.getAll()});
      this.setAssigned();
    },

    onTagsUpdate(storeTags: TagCollection) {
      const tags = assign(
        {},
        storeTags,
        TagStore.getIssueAttributes(),
        TagStore.getBuiltInTags()
      );
      this.setState({tags});
      this.setAssigned();
    },

    setAssigned() {
      const {tags, users, teams} = this.state;
      const usernames: string[] = users.map(getUsername);
      const teamnames: string[] = teams
        .filter(team => team.isMember)
        .map(team => `#${team.name}`);
      const allAssigned = usernames.concat(teamnames);
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
        },
      });
    },

    render() {
      const {tags, ...props} = this.props as P;
      return <WrappedComponent {...({tags: tags ?? this.state.tags, ...props} as P)} />;
    },
  });

export default withIssueTags;

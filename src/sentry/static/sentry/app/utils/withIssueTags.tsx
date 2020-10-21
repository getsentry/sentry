import * as React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import assign from 'lodash/assign';

import getDisplayName from 'app/utils/getDisplayName';
import MemberListStore from 'app/stores/memberListStore';
import TagStore from 'app/stores/tagStore';
import {User, TagCollection} from 'app/types';

type InjectedTagsProps = {
  tags: TagCollection;
};

type State = {
  tags: TagCollection;
  users: User[];
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

      return {tags, users};
    },

    onMemberListStoreChange(users: User[]) {
      this.setState({users});
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
      if (this.state.users && this.state.tags.assigned) {
        const {tags, users} = this.state;
        const usernames: string[] = users.map(getUsername);
        usernames.unshift('me');

        this.setState({
          tags: {
            ...tags,
            assigned: {
              ...tags.assigned,
              values: usernames,
            },
            bookmarks: {
              ...tags.bookmarks,
              values: usernames,
            },
          },
        });
      }
    },

    render() {
      const {tags, ...props} = this.props as P;
      return <WrappedComponent {...({tags: tags ?? this.state.tags, ...props} as P)} />;
    },
  });

export default withIssueTags;

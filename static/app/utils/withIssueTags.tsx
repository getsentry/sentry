import {useCallback, useEffect, useState} from 'react';
import assign from 'lodash/assign';

import MemberListStore from 'sentry/stores/memberListStore';
import TagStore from 'sentry/stores/tagStore';
import TeamStore from 'sentry/stores/teamStore';
import {TagCollection, Team, User} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

export interface WithIssueTagsProps {
  tags: TagCollection;
}

const uuidPattern = /[0-9a-f]{32}$/;
const getUsername = ({isManaged, username, email}: User) => {
  // Users created via SAML receive unique UUID usernames. Use
  // their email in these cases, instead.
  if (username && uuidPattern.test(username)) {
    return email;
  }
  return !isManaged && username ? username : email;
};

type WrappedComponentState = {
  tags: TagCollection;
  teams: Team[];
  users: User[];
};
/**
 * HOC for getting tags and many useful issue attributes as 'tags' for use
 * in autocomplete selectors or condition builders.
 */
function withIssueTags<Props extends WithIssueTagsProps>(
  WrappedComponent: React.ComponentType<Props>
) {
  function ComponentWithTags(props: Omit<Props, keyof WithIssueTagsProps>) {
    const [state, setState] = useState<WrappedComponentState>({
      tags: assign(
        {},
        TagStore.getAllTags(),
        TagStore.getIssueAttributes(),
        TagStore.getBuiltInTags()
      ),
      users: MemberListStore.getAll(),
      teams: TeamStore.getAll(),
    });

    const setAssigned = useCallback(
      (newState: Partial<WrappedComponentState>) => {
        setState(oldState => {
          const usernames: string[] = newState.users
            ? newState.users.map(getUsername)
            : oldState.users.map(getUsername);

          const teamnames: string[] = (newState.teams ? newState.teams : oldState.teams)
            .filter(team => team.isMember)
            .map(team => `#${team.slug}`);

          const allAssigned = ['[me, none]', ...usernames, ...teamnames];
          allAssigned.unshift('me');
          usernames.unshift('me');

          return {
            ...oldState,
            ...newState,
            tags: {
              ...oldState.tags,
              ...newState.tags,
              assigned: {
                ...(newState.tags?.assigned ?? oldState.tags?.assigned ?? {}),
                values: allAssigned,
              },
              bookmarks: {
                ...(newState.tags?.bookmarks ?? oldState.tags?.bookmarks ?? {}),
                values: usernames,
              },
              assigned_or_suggested: {
                ...(newState.tags?.assigned_or_suggested ??
                  oldState.tags.assigned_or_suggested ??
                  {}),
                values: allAssigned,
              },
            },
          };
        });
      },
      [state]
    );

    // Listen to team store updates and cleanup listener on unmount
    useEffect(() => {
      const unsubscribeTeam = TeamStore.listen(() => {
        setAssigned({teams: TeamStore.getAll()});
      }, undefined);

      return () => unsubscribeTeam();
    }, []);

    // Listen to tag store updates and cleanup listener on unmount
    useEffect(() => {
      const unsubscribeTags = TagStore.listen((storeTags: TagCollection) => {
        const tags = assign(
          {},
          storeTags,
          TagStore.getIssueAttributes(),
          TagStore.getBuiltInTags()
        );

        setAssigned({tags});
      }, undefined);

      return () => unsubscribeTags();
    }, []);

    // Listen to member store updates and cleanup listener on unmount
    useEffect(() => {
      const unsubscribeMembers = MemberListStore.listen((users: User[]) => {
        setAssigned({users});
      }, undefined);

      return () => unsubscribeMembers();
    }, []);

    return <WrappedComponent {...(props as Props)} tags={state.tags} />;
  }
  ComponentWithTags.displayName = `withIssueTags(${getDisplayName(WrappedComponent)})`;
  return ComponentWithTags;
}

export default withIssueTags;

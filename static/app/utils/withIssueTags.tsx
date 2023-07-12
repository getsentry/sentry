import {useCallback, useEffect, useState} from 'react';

import {ItemType, SearchGroup} from 'sentry/components/smartSearchBar/types';
import {IconStar, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import TagStore from 'sentry/stores/tagStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Organization, TagCollection, Team, User} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

export interface WithIssueTagsProps {
  organization: Organization;
  tags: TagCollection;
}

type HocProps = {
  organization: Organization;
};

const uuidPattern = /[0-9a-f]{32}$/;
const getUsername = ({isManaged, username, email}: User) => {
  // Users created via SAML receive unique UUID usernames. Use
  // their email in these cases, instead.
  if (username && uuidPattern.test(username)) {
    return email;
  }
  return !isManaged && username ? username : email;
};

const escapeValue = (value: string): string => {
  // Wrap in quotes if there is a space
  return value.includes(' ') || value.includes('"')
    ? `"${value.replace(/"/g, '\\"')}"`
    : value;
};

function convertToSearchItem(value: string) {
  const escapedValue = escapeValue(value);
  return {
    value: escapedValue,
    desc: value,
    type: ItemType.TAG_VALUE,
  };
}

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
  function ComponentWithTags(props: Omit<Props, keyof WithIssueTagsProps> & HocProps) {
    const [state, setState] = useState<WrappedComponentState>({
      tags: TagStore.getIssueTags(props.organization),
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

          const meAndMyTeams = props.organization.features.includes('assign-to-me')
            ? '[me, my_teams, none]'
            : '[me, none]';
          const suggestedValues: string[] = [
            'me',
            ...(props.organization.features.includes('assign-to-me') ? ['my_teams'] : []),
            meAndMyTeams,
            ...teamnames,
          ];
          const assigndValues: SearchGroup[] | string[] =
            !props.organization.features.includes('issue-search-shortcuts')
              ? [
                  {
                    title: t('Suggested Values'),
                    type: 'header',
                    icon: <IconStar size="xs" />,
                    children: suggestedValues.map(convertToSearchItem),
                  },
                  {
                    title: t('All Values'),
                    type: 'header',
                    icon: <IconUser size="xs" />,
                    children: usernames.map(convertToSearchItem),
                  },
                ]
              : [...suggestedValues, ...usernames];

          return {
            ...oldState,
            ...newState,
            tags: {
              ...oldState.tags,
              ...newState.tags,
              assigned: {
                ...(newState.tags?.assigned ?? oldState.tags?.assigned ?? {}),
                values: assigndValues,
              },
              bookmarks: {
                ...(newState.tags?.bookmarks ?? oldState.tags?.bookmarks ?? {}),
                values: ['me', ...usernames],
              },
              assigned_or_suggested: {
                ...(newState.tags?.assigned_or_suggested ??
                  oldState.tags.assigned_or_suggested ??
                  {}),
                values: assigndValues,
              },
            },
          };
        });
      },
      [props.organization]
    );

    // Listen to team store updates and cleanup listener on unmount
    useEffect(() => {
      const unsubscribeTeam = TeamStore.listen(() => {
        setAssigned({teams: TeamStore.getAll()});
      }, undefined);

      return () => unsubscribeTeam();
    }, [setAssigned]);

    // Listen to tag store updates and cleanup listener on unmount
    useEffect(() => {
      const unsubscribeTags = TagStore.listen(() => {
        setAssigned({tags: TagStore.getIssueTags(props.organization)});
      }, undefined);

      return () => unsubscribeTags();
    }, [props.organization, setAssigned]);

    // Listen to member store updates and cleanup listener on unmount
    useEffect(() => {
      const unsubscribeMembers = MemberListStore.listen(
        ({members}: typeof MemberListStore.state) => {
          setAssigned({users: members});
        },
        undefined
      );

      return () => unsubscribeMembers();
    }, [setAssigned]);

    return <WrappedComponent {...(props as Props)} tags={state.tags} />;
  }
  ComponentWithTags.displayName = `withIssueTags(${getDisplayName(WrappedComponent)})`;
  return ComponentWithTags;
}

export default withIssueTags;

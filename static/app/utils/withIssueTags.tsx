import {useEffect, useMemo, useState} from 'react';

import {ItemType, SearchGroup} from 'sentry/components/smartSearchBar/types';
import {escapeTagValue} from 'sentry/components/smartSearchBar/utils';
import {IconStar, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import TagStore from 'sentry/stores/tagStore';
import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization, TagCollection, User} from 'sentry/types';
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

function convertToSearchItem(value: string) {
  const escapedValue = escapeTagValue(value);
  return {
    value: escapedValue,
    desc: value,
    type: ItemType.TAG_VALUE,
  };
}

/**
 * HOC for getting tags and many useful issue attributes as 'tags' for use
 * in autocomplete selectors or condition builders.
 */
function withIssueTags<Props extends WithIssueTagsProps>(
  WrappedComponent: React.ComponentType<Props>
) {
  function ComponentWithTags(props: Omit<Props, keyof WithIssueTagsProps> & HocProps) {
    const {teams} = useLegacyStore(TeamStore);
    const {members} = useLegacyStore(MemberListStore);
    const [tags, setTags] = useState<TagCollection>(
      TagStore.getIssueTags(props.organization)
    );

    const issueTags = useMemo((): TagCollection => {
      const usernames: string[] = members.map(getUsername);
      const userTeams = teams.filter(team => team.isMember).map(team => `#${team.slug}`);
      const nonMemberTeams = teams
        .filter(team => !team.isMember)
        .map(team => `#${team.slug}`);

      const meAndMyTeams = ['my_teams', '[me, my_teams, none]'];
      const suggestedAssignees: string[] = ['me', ...meAndMyTeams, ...userTeams];
      const assigndValues: SearchGroup[] | string[] = [
        {
          title: t('Suggested Values'),
          type: 'header',
          icon: <IconStar size="xs" />,
          children: suggestedAssignees.map(convertToSearchItem),
        },
        {
          title: t('All Values'),
          type: 'header',
          icon: <IconUser size="xs" />,
          children: [
            ...usernames.map(convertToSearchItem),
            ...nonMemberTeams.map(convertToSearchItem),
          ],
        },
      ];

      return {
        ...tags,
        assigned: {
          ...tags.assigned,
          values: assigndValues,
        },
        bookmarks: {
          ...tags.bookmarks,
          values: ['me', ...usernames],
        },
        assigned_or_suggested: {
          ...tags.assigned_or_suggested,
          values: assigndValues,
        },
      };
    }, [teams, members, tags]);

    // Listen to tag store updates and cleanup listener on unmount
    useEffect(() => {
      const unsubscribeTags = TagStore.listen(() => {
        setTags(TagStore.getIssueTags(props.organization));
      }, undefined);

      return () => unsubscribeTags();
    }, [props.organization, setTags]);

    return <WrappedComponent {...(props as Props)} tags={issueTags} />;
  }
  ComponentWithTags.displayName = `withIssueTags(${getDisplayName(WrappedComponent)})`;
  return ComponentWithTags;
}

export default withIssueTags;

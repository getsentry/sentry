import {useMemo} from 'react';

import {TeamAvatar, UserAvatar} from '@sentry/scraps/avatar';
import type {ComposerSource} from '@sentry/scraps/composer';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {Member, Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {memberUsersQueryOptions} from 'sentry/utils/members/shared';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';

export type OrgMentionEntity = {kind: 'member'; user: User} | {kind: 'team'; team: Team};

/**
 * A single `@` source that suggests both org members and teams. Consumers
 * that need the resolved suggestion (e.g. to render a chip) can switch on
 * `suggestion.kind`.
 */
export function useOrgMentionSources(): ReadonlyArray<ComposerSource<OrgMentionEntity>> {
  const organization = useOrganization();
  const {teams} = useTeams();

  const teamSuggestions = useMemo(
    () => teams.map(team => ({kind: 'team', team}) as const satisfies OrgMentionEntity),
    [teams]
  );

  return useMemo(
    () =>
      [
        {
          id: 'mentions',
          label: t('Members & Teams'),
          trigger: '@',
          queryOptions: query =>
            getMentionQueryOptions(organization.slug, query, teamSuggestions),
          getId: getMentionId,
          getText: suggestion => `@${getMentionLabel(suggestion)}`,
          renderSuggestion: suggestion => <MentionIdentity suggestion={suggestion} />,
        },
      ] satisfies ReadonlyArray<ComposerSource<OrgMentionEntity>>,
    [organization.slug, teamSuggestions]
  );
}

function getMentionQueryOptions(
  orgSlug: string,
  query: string,
  teamSuggestions: readonly OrgMentionEntity[]
) {
  const memberOptions = memberUsersQueryOptions({orgSlug, search: query.trim()});
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredTeams = teamSuggestions.filter(suggestion =>
    getMentionLabel(suggestion).toLocaleLowerCase().includes(normalizedQuery)
  );

  return {
    ...memberOptions,
    select: (response: ApiResponse<Member[]>): readonly OrgMentionEntity[] => [
      ...filteredTeams,
      ...memberOptions
        .select(response)
        .map(user => ({kind: 'member', user}) as const satisfies OrgMentionEntity),
    ],
  };
}

function MentionIdentity({suggestion}: {suggestion: OrgMentionEntity}) {
  const label = getMentionLabel(suggestion);
  const email = suggestion.kind === 'member' ? suggestion.user.email : null;

  return (
    <Flex as="span" align="center" gap="xs">
      <Flex as="span" align="center" aria-hidden="true">
        {suggestion.kind === 'member' ? (
          <UserAvatar user={suggestion.user} size={16} hasTooltip={false} />
        ) : (
          <TeamAvatar team={suggestion.team} size={16} hasTooltip={false} />
        )}
      </Flex>
      <Stack as="span" minWidth="0">
        <Text as="span" size="sm" ellipsis>
          {label}
        </Text>
        {email && email !== label ? (
          <Text as="span" size="xs" variant="muted" ellipsis>
            {email}
          </Text>
        ) : null}
      </Stack>
    </Flex>
  );
}

function getMentionLabel(suggestion: OrgMentionEntity): string {
  switch (suggestion.kind) {
    case 'member':
      return (
        suggestion.user.name ||
        suggestion.user.email ||
        suggestion.user.username ||
        suggestion.user.id
      );
    case 'team':
      return suggestion.team.slug;
  }
}

function getMentionId(suggestion: OrgMentionEntity): string {
  switch (suggestion.kind) {
    case 'member':
      return `user:${suggestion.user.id}`;
    case 'team':
      return `team:${suggestion.team.id}`;
  }
}

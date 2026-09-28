import {useMemo} from 'react';

import {TeamAvatar, UserAvatar} from '@sentry/scraps/avatar';
import type {ComposerPlugin, ComposerSource} from '@sentry/scraps/composer';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {Member, Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {defined} from 'sentry/utils/defined';
import {memberUsersQueryOptions} from 'sentry/utils/members/shared';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';

const DEFAULT_USER_TRIGGER = '@';
const DEFAULT_TEAM_TRIGGER = '@';

type MemberSuggestion = {kind: 'member'; user: User};
type TeamSuggestion = {kind: 'team'; team: Team};

interface OrgMentionPluginOptions {
  /** Team suggestions. Pass an object to override the default trigger. */
  team?: boolean | {trigger?: string};
  /** Member suggestions. Pass an object to override the default trigger. */
  user?: boolean | {trigger?: string};
}

/**
 * Org member and team mention suggestions. By default both share the `@`
 * trigger; pass `{team: {trigger: '#'}}` to restore the split `@`/`#` scheme.
 */
export function useOrgMentionPlugins({
  user = true,
  team = true,
}: OrgMentionPluginOptions = {}): readonly ComposerPlugin[] {
  const organization = useOrganization();
  const {teams} = useTeams();

  const userTrigger = resolveTrigger(user, DEFAULT_USER_TRIGGER);
  const teamTrigger = resolveTrigger(team, DEFAULT_TEAM_TRIGGER);

  const memberSource = useMemo(
    () =>
      userTrigger
        ? userMentionSource({trigger: userTrigger, orgSlug: organization.slug})
        : null,
    [organization.slug, userTrigger]
  );
  const teamSource = useMemo(
    () => (teamTrigger ? teamMentionSource({trigger: teamTrigger, teams}) : null),
    [teamTrigger, teams]
  );

  return useMemo(
    () => [
      {
        id: 'mentions',
        getSources: () => [memberSource, teamSource].filter(defined),
      },
    ],
    [memberSource, teamSource]
  );
}

function resolveTrigger(
  option: boolean | {trigger?: string} | undefined,
  defaultTrigger: string
): string | null {
  if (!option) {
    return null;
  }
  if (option === true) {
    return defaultTrigger;
  }
  return option.trigger ?? defaultTrigger;
}

function userMentionSource({
  trigger,
  orgSlug,
}: {
  orgSlug: string;
  trigger: string;
}): ComposerSource<MemberSuggestion> {
  return {
    id: 'members',
    label: t('Members'),
    trigger,
    queryOptions: query => getMemberMentionQueryOptions(orgSlug, query),
    getId: getMentionId,
    getText: suggestion => `${trigger}${getMentionLabel(suggestion)}`,
    renderSuggestion: suggestion => (
      <MentionIdentity suggestion={suggestion} label={getMentionLabel(suggestion)} />
    ),
  };
}

function teamMentionSource({
  teams,
  trigger,
}: {
  teams: Team[];
  trigger: string;
}): ComposerSource<TeamSuggestion> {
  return {
    id: 'teams',
    label: t('Teams'),
    trigger,
    getSuggestions: query => {
      const normalizedQuery = query.trim().toLocaleLowerCase();
      return teams
        .filter(team => team.slug.toLocaleLowerCase().includes(normalizedQuery))
        .map(team => ({kind: 'team', team}) as const satisfies TeamSuggestion);
    },
    getId: getMentionId,
    getText: suggestion => `${trigger}${suggestion.team.slug}`,
    renderSuggestion: suggestion => (
      <MentionIdentity
        suggestion={suggestion}
        label={`${trigger}${suggestion.team.slug}`}
      />
    ),
  };
}

function getMemberMentionQueryOptions(orgSlug: string, query: string) {
  const options = memberUsersQueryOptions({orgSlug, search: query.trim()});

  return {
    ...options,
    select: (response: ApiResponse<Member[]>): readonly MemberSuggestion[] =>
      options
        .select(response)
        .map(user => ({kind: 'member', user}) as const satisfies MemberSuggestion),
  };
}

function MentionIdentity({
  label,
  suggestion,
}: {
  label: string;
  suggestion: MemberSuggestion | TeamSuggestion;
}) {
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

function getMentionLabel(suggestion: MemberSuggestion): string {
  return (
    suggestion.user.name ||
    suggestion.user.email ||
    suggestion.user.username ||
    suggestion.user.id
  );
}

function getMentionId(suggestion: MemberSuggestion | TeamSuggestion): string {
  switch (suggestion.kind) {
    case 'member':
      return `user:${suggestion.user.id}`;
    case 'team':
      return `team:${suggestion.team.id}`;
  }
}

import {useEffect, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import debounce from 'lodash/debounce';
import uniqBy from 'lodash/uniqBy';

import {TeamAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import type {SelectOptionOrSection} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconChevron, IconGrid, IconTable, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {memberUsersQueryOptions} from 'sentry/utils/members/shared';
import {useMembers} from 'sentry/utils/members/useMembers';
import {getUsername} from 'sentry/utils/membersAndTeams/userUtils';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';
import {useTeamsById} from 'sentry/utils/useTeamsById';

import {DEFAULT_STATS_PERIOD, PERIOD_FILTER_OPTIONS} from './periods';
import type {OverviewView, SortValue} from './types';

const SORT_OPTIONS: Array<{label: string; value: SortValue}> = [
  {value: 'activity', label: t('Recent activity')},
  {value: 'events', label: t('Most events')},
];

// The special "self"/"none" assignee tokens accepted by the issue-search
// `assigned:` filter. Values map directly to the search token appended to the
// query in `useAutofixSections`.
const SPECIAL_ASSIGNEE_OPTIONS = [
  {value: 'me', label: t('Assigned to me'), leadingItems: <IconUser size="sm" />},
  {value: 'my_teams', label: t('My teams'), leadingItems: <IconUser size="sm" />},
  {value: 'none', label: t('Unassigned'), leadingItems: <IconUser size="sm" />},
];

function isSpecialAssignee(value: string | undefined) {
  return SPECIAL_ASSIGNEE_OPTIONS.some(option => option.value === value);
}

function makeMemberOption(member: User) {
  const username = getUsername(member);
  return {
    value: username,
    label: member.name || member.email,
    textValue: [member.name, member.email, member.username, username]
      .filter(Boolean)
      .join(' '),
    leadingItems: <UserAvatar user={member} size={16} />,
  };
}

function useAssigneeOptions(assignee: string | undefined): {
  isFetching: boolean;
  onSearch: (value: string) => void;
  options: Array<SelectOptionOrSection<string>>;
} {
  const organization = useOrganization();
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const defaultMembersQuery = useMembers();
  const searchedMembersQuery = useQuery({
    ...memberUsersQueryOptions({
      orgSlug: organization.slug,
      search: memberSearchTerm,
    }),
    enabled: memberSearchTerm !== '',
  });
  const teamSearch = useTeams();
  const searchTeams = teamSearch.onSearch;
  const selectedTeamSlug = assignee?.startsWith('#') ? assignee.slice(1) : undefined;
  const selectedMemberValue =
    assignee && !selectedTeamSlug && !isSpecialAssignee(assignee) ? assignee : undefined;
  const selectedTeamSlugs = useMemo(
    () => (selectedTeamSlug ? [selectedTeamSlug] : undefined),
    [selectedTeamSlug]
  );
  const selectedTeamQuery = useTeamsById({slugs: selectedTeamSlugs});
  const selectedMemberQuery = useQuery({
    ...memberUsersQueryOptions({
      orgSlug: organization.slug,
      search: selectedMemberValue,
    }),
    enabled: Boolean(selectedMemberValue),
  });

  const onSearch = useMemo(
    () =>
      debounce((value: string) => {
        setMemberSearchTerm(value);
        void searchTeams(value.replace(/^#/, ''));
      }, DEFAULT_DEBOUNCE_DURATION),
    [searchTeams]
  );

  useEffect(() => () => onSearch.cancel(), [onSearch]);

  const options = useMemo<Array<SelectOptionOrSection<string>>>(() => {
    const teams = teamSearch.teams.map(team => ({
      value: `#${team.slug}`,
      label: `#${team.slug}`,
      textValue: `#${team.slug} ${team.slug}`,
      leadingItems: <TeamAvatar team={team} size={16} />,
    }));
    const memberUsers = uniqBy(
      [
        ...(defaultMembersQuery.data ?? []),
        ...(searchedMembersQuery.data ?? []),
        ...(selectedMemberQuery.data ?? []),
      ],
      member => member.id
    );
    const resolvedSelectedMember = selectedMemberValue
      ? selectedMemberQuery.data?.find(member =>
          [getUsername(member), member.username, member.email].includes(
            selectedMemberValue
          )
        )
      : undefined;
    const members = memberUsers.map(member => {
      const option = makeMemberOption(member);
      return resolvedSelectedMember?.id === member.id && assignee
        ? {...option, value: assignee}
        : option;
    });

    if (
      assignee &&
      selectedTeamSlug &&
      !teams.some(option => option.value === assignee)
    ) {
      teams.unshift({
        value: assignee,
        label: assignee,
        textValue: `${assignee} ${selectedTeamSlug}`,
        leadingItems: <IconUser size="sm" />,
      });
    }
    if (
      assignee &&
      selectedMemberValue &&
      !members.some(option => option.value === assignee)
    ) {
      members.unshift({
        value: assignee,
        label: assignee,
        textValue: assignee,
        leadingItems: <IconUser size="sm" />,
      });
    }

    return [
      {label: t('Suggested'), options: SPECIAL_ASSIGNEE_OPTIONS},
      {label: t('Teams'), options: teams},
      {label: t('Members'), options: members},
    ];
  }, [
    assignee,
    defaultMembersQuery.data,
    searchedMembersQuery.data,
    selectedMemberQuery.data,
    selectedMemberValue,
    selectedTeamSlug,
    teamSearch.teams,
  ]);

  return {
    options,
    onSearch,
    isFetching:
      defaultMembersQuery.isFetching ||
      searchedMembersQuery.isFetching ||
      teamSearch.fetching ||
      selectedMemberQuery.isFetching ||
      selectedTeamQuery.isLoading,
  };
}

export function OverviewFilters({
  allCollapsed,
  assignee,
  onToggleAll,
  onUpdateQuery,
  onViewChange,
  period,
  sort,
  view,
}: {
  allCollapsed: boolean;
  assignee: string | undefined;
  onToggleAll: () => void;
  onUpdateQuery: (patch: Record<string, string | string[] | undefined>) => void;
  onViewChange: (view: OverviewView) => void;
  period: string;
  sort: SortValue;
  view: OverviewView;
}) {
  const {
    isFetching: assigneesFetching,
    onSearch: onAssigneeSearch,
    options: assigneeOptions,
  } = useAssigneeOptions(assignee);

  return (
    <Flex justify="between" align="center" gap="md" wrap="wrap">
      <Flex gap="md" align="center" wrap="wrap">
        <PageFilterBar condensed>
          <ProjectPageFilter />
        </PageFilterBar>
        <CompactSelect
          value={assignee}
          options={assigneeOptions}
          search={{
            placeholder: t('Search assignees…'),
            onChange: onAssigneeSearch,
          }}
          loading={assigneesFetching}
          clearable
          onChange={selected =>
            onUpdateQuery({assignee: selected ? String(selected.value) : undefined})
          }
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} size="sm" prefix={t('Assignee')} />
          )}
        />
        <CompactSelect
          value={period}
          options={PERIOD_FILTER_OPTIONS}
          onChange={selected =>
            onUpdateQuery({
              period:
                selected.value === DEFAULT_STATS_PERIOD
                  ? undefined
                  : String(selected.value),
            })
          }
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} size="sm" prefix={t('Activity')} />
          )}
        />
        <CompactSelect
          value={sort}
          options={SORT_OPTIONS}
          onChange={selected =>
            onUpdateQuery({
              // Default sort keeps the URL clean.
              sort: selected.value === 'activity' ? undefined : String(selected.value),
            })
          }
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} size="sm" prefix={t('Sort')} />
          )}
        />
      </Flex>
      <Flex gap="xl" align="center">
        <Button
          size="xs"
          variant="link"
          icon={
            <IconChevron isDouble direction={allCollapsed ? 'down' : 'up'} size="xs" />
          }
          onClick={onToggleAll}
        >
          {allCollapsed ? t('Expand all') : t('Collapse all')}
        </Button>
        <SegmentedControl<OverviewView>
          size="xs"
          value={view}
          onChange={onViewChange}
          aria-label={t('View mode')}
        >
          <SegmentedControl.Item
            key="cards"
            icon={<IconGrid />}
            aria-label={t('Card view')}
            tooltip={t('Card view')}
          />
          <SegmentedControl.Item
            key="table"
            icon={<IconTable />}
            aria-label={t('Table view')}
            tooltip={t('Table view')}
          />
        </SegmentedControl>
      </Flex>
    </Flex>
  );
}

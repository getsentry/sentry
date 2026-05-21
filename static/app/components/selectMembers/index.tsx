import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Select, type GeneralSelectValue, type StylesConfig} from '@sentry/scraps/select';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IdBadge} from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {useProjectMembersQueryOptions} from 'sentry/utils/members/projectMembers';
import {
  memberUsersQueryOptions,
  selectUsersFromMembers,
} from 'sentry/utils/members/shared';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

const getSearchKeyForUser = (user: User) =>
  `${user.email?.toLowerCase()} ${user.name?.toLowerCase()}`;

const EMPTY_USERS: User[] = [];

type SelectMemberValue = null | number | string | undefined;

interface MentionableUser extends SelectValue<string> {
  actor: {
    email: string;
    id: string;
    name: string;
    type: 'user';
  };
  label: React.ReactElement;
  searchKey: string;
}

interface Props {
  onChange: (value: MentionableUser) => void;
  organization: Organization;
  value: SelectMemberValue;
  'aria-label'?: string;
  disabled?: boolean;
  projectIds?: readonly string[];
  styles?: StylesConfig;
}

interface FilterOption {
  data: MentionableUser;
}

function isMentionableUser(option: GeneralSelectValue): option is MentionableUser {
  const actor = (option as Partial<MentionableUser>).actor;

  return typeof option.value === 'string' && actor?.type === 'user';
}

function filterMemberOption(option: FilterOption, filterText: string) {
  return option?.data?.searchKey?.includes(filterText.toLowerCase());
}

/**
 * A component that allows you to select organization members.
 */
function SelectMembers({
  'aria-label': ariaLabel,
  disabled,
  onChange,
  organization,
  projectIds,
  styles,
  value,
}: Props) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const {data: users = [], isPending: memberListLoading} = useQuery({
    ...useProjectMembersQueryOptions(projectIds),
    select: resp => selectUsersFromMembers(resp.json),
  });
  const searchMembersQuery = useQuery({
    ...memberUsersQueryOptions({
      orgSlug: organization.slug,
      search: debouncedSearch,
    }),
    enabled: debouncedSearch !== '',
    placeholderData: previousData => (debouncedSearch ? previousData : undefined),
  });
  const searchedUsers = debouncedSearch
    ? (searchMembersQuery.data ?? EMPTY_USERS)
    : EMPTY_USERS;
  const searchLoading = debouncedSearch !== '' && searchMembersQuery.isFetching;

  const renderUserBadge = useCallback(
    (user: User) => <IdBadge avatarSize={24} user={user} hideEmail disableLink />,
    []
  );

  const createMentionableUser = useCallback(
    (user: User): MentionableUser => ({
      value: user.id,
      label: renderUserBadge(user),
      searchKey: getSearchKeyForUser(user),
      actor: {
        type: 'user',
        email: user.email,
        id: user.id,
        name: user.name,
      },
    }),
    [renderUserBadge]
  );

  const createUnmentionableUser = useCallback(
    (user: User): MentionableUser => ({
      ...createMentionableUser(user),
      disabled: true,
      label: (
        <DisabledLabel>
          <Tooltip
            position="left"
            title={t('%s is not a member of project', user.name || user.email)}
          >
            {renderUserBadge(user)}
          </Tooltip>
        </DisabledLabel>
      ),
    }),
    [createMentionableUser, renderUserBadge]
  );

  const usersInProjectById = useMemo(() => new Set(users.map(({id}) => id)), [users]);
  const mentionableUsers = useMemo(
    () => users.map(createMentionableUser),
    [createMentionableUser, users]
  );
  const unmentionableUsers = useMemo(
    () =>
      searchedUsers
        .filter(user => !usersInProjectById.has(user.id))
        .map(createUnmentionableUser),
    [createUnmentionableUser, searchedUsers, usersInProjectById]
  );

  const currentOptions = useMemo(
    () => [...mentionableUsers, ...unmentionableUsers],
    [mentionableUsers, unmentionableUsers]
  );

  const handleInputChange = (nextInputValue: string) => {
    setSearch(nextInputValue);
  };
  const handleChange = (option: GeneralSelectValue | GeneralSelectValue[] | null) => {
    if (!option || Array.isArray(option)) {
      return;
    }

    if (isMentionableUser(option)) {
      onChange(option);
    }
  };
  const selectStyles: StylesConfig = useMemo(
    () => ({
      ...styles,
      option: (provided, state) => ({
        ...provided,
        svg: {
          color: state.isSelected ? '#fff' : undefined,
        },
      }),
    }),
    [styles]
  );

  // Keep the select disabled until project-scoped members have loaded so the
  // default option set is complete before users can search.
  if (memberListLoading) {
    return (
      <StyledSelectControl aria-label={ariaLabel} isDisabled placeholder={t('Loading')} />
    );
  }

  const selectedValue = value === null || value === undefined ? undefined : String(value);
  const selectedOption = currentOptions.find(option => option.value === selectedValue);

  return (
    <StyledSelectControl
      aria-label={ariaLabel}
      options={currentOptions}
      filterOption={filterMemberOption}
      isDisabled={disabled}
      isLoading={searchLoading}
      onInputChange={handleInputChange}
      onChange={handleChange}
      value={selectedOption}
      styles={selectStyles}
    />
  );
}

const DisabledLabel = styled('div')`
  display: flex;
  opacity: 0.5;
  overflow: hidden; /* Needed so that "Add to team" button can fit */
`;

const StyledSelectControl = styled(Select)`
  .Select-value {
    display: flex;
    align-items: center;
  }
  .Select-input {
    margin-left: 32px;
  }
`;

// eslint-disable-next-line @sentry/no-default-exports
export default SelectMembers;

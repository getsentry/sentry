import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useDebouncedValue} from '@tanstack/react-pacer';
import {useQuery} from '@tanstack/react-query';

import {
  Select,
  CheckWrap,
  components,
  type SingleValueProps,
  type StylesConfig,
  type SelectValue,
} from '@sentry/scraps/select';
import {Tooltip} from '@sentry/scraps/tooltip';

import {UserBadge} from 'sentry/components/idBadge/userBadge';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {useProjectMembersQueryOptions} from 'sentry/utils/members/projectMembers';
import {
  memberUsersQueryOptions,
  selectUsersFromMembers,
} from 'sentry/utils/members/shared';

const getSearchKeyForUser = (user: User) =>
  `${user.email?.toLowerCase()} ${user.name?.toLowerCase()}`;

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
  user: User;
}

interface Props {
  onChange: (value: MentionableUser) => void;
  organization: Organization;
  value: SelectMemberValue;
  'aria-label'?: string;
  projectIds?: readonly string[];
  styles?: StylesConfig;
}

interface FilterOption {
  data: MentionableUser;
}

function filterMemberOption(option: FilterOption, filterText: string) {
  return option.data.searchKey.includes(filterText.toLowerCase());
}

function SelectedMember(props: SingleValueProps<MentionableUser>) {
  return (
    <components.SingleValue {...props}>
      <UserBadge avatarSize={20} user={props.data.user} hideEmail />
    </components.SingleValue>
  );
}

const memberSelectComponents = {SingleValue: SelectedMember};

function createMentionableUser(user: User): MentionableUser {
  return {
    value: user.id,
    label: (
      <UserBadge
        avatarSize={20}
        user={user}
        minHeight="32px"
        hideEmail
        description={user.name && user.name !== user.email ? user.email : undefined}
      />
    ),
    searchKey: getSearchKeyForUser(user),
    user,
    actor: {
      type: 'user',
      email: user.email,
      id: user.id,
      name: user.name,
    },
  };
}

function createUnmentionableUser(user: User): MentionableUser {
  const option = createMentionableUser(user);
  return {
    ...option,
    disabled: true,
    label: (
      <DisabledLabel>
        <Tooltip
          position="left"
          title={t('%s is not a member of project', user.name || user.email)}
        >
          {option.label}
        </Tooltip>
      </DisabledLabel>
    ),
  };
}

/**
 * A component that allows you to select organization members.
 */
function SelectMembers({
  'aria-label': ariaLabel,
  onChange,
  organization,
  projectIds,
  styles,
  value,
}: Props) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, {wait: 250});
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
  const searchLoading = debouncedSearch !== '' && searchMembersQuery.isFetching;

  const currentOptions = useMemo(() => {
    const searchedUsers = debouncedSearch ? (searchMembersQuery.data ?? []) : [];
    const usersInProjectById = new Set(users.map(({id}) => id));
    return [
      ...users.map(createMentionableUser),
      ...searchedUsers
        .filter(user => !usersInProjectById.has(user.id))
        .map(createUnmentionableUser),
    ];
  }, [users, debouncedSearch, searchMembersQuery.data]);

  const selectedValue = value === null || value === undefined ? undefined : String(value);
  const hasSelectedMember = currentOptions.some(option => option.value === selectedValue);

  const selectStyles: StylesConfig = useMemo(
    () => ({
      ...styles,
      menu: (provided, state) => ({
        ...provided,
        ...styles?.menu?.(provided, state),
        width: 320,
      }),
      menuList: (provided, state) => ({
        ...provided,
        ...styles?.menuList?.(provided, state),
        '.option > div': {
          paddingBlock: 4,
        },
        [String(CheckWrap)]: {
          height: 32,
        },
      }),
      input: (provided, state) => ({
        ...provided,
        ...styles?.input?.(provided, state),
        // Align the caret after the selected member's 20px avatar and 6px gap.
        paddingLeft: hasSelectedMember && !search ? 26 : 0,
      }),
      option: (provided, state) => ({
        ...provided,
        svg: {
          color: state.isSelected ? '#fff' : undefined,
        },
      }),
    }),
    [styles, hasSelectedMember, search]
  );

  // Keep the select disabled until project-scoped members have loaded so the
  // default option set is complete before users can search.
  if (memberListLoading) {
    return (
      <Select
        aria-label={ariaLabel}
        isDisabled
        placeholder={t('Loading')}
        styles={selectStyles}
      />
    );
  }

  return (
    <Select<MentionableUser>
      aria-label={ariaLabel}
      options={currentOptions}
      components={memberSelectComponents}
      filterOption={filterMemberOption}
      isLoading={searchLoading}
      onInputChange={setSearch}
      onChange={option => onChange(option)}
      value={selectedValue}
      styles={selectStyles}
    />
  );
}

const DisabledLabel = styled('div')`
  display: flex;
  opacity: 0.5;
  overflow: hidden; /* Needed so that "Add to team" button can fit */
`;

// eslint-disable-next-line @sentry/no-default-exports
export default SelectMembers;

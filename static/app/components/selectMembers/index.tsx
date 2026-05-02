import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Select} from '@sentry/scraps/select';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IdBadge} from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import type {Member, Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {useApi} from 'sentry/utils/useApi';
import {
  selectUsersFromMembers,
  useOrganizationUsers,
} from 'sentry/utils/useOrganizationUsers';

const getSearchKeyForUser = (user: User) =>
  `${user.email?.toLowerCase()} ${user.name?.toLowerCase()}`;

type MentionableUser = {
  actor: {
    id: string;
    name: string;
    type: 'user';
  };
  label: React.ReactElement;
  searchKey: string;
  value: string;
  disabled?: boolean;
};

type Props = {
  onChange: (value: any) => any;
  organization: Organization;
  value: any;
  'aria-label'?: string;
  ariaLabel?: string;
  disabled?: boolean;
  onInputChange?: (value: any) => any;
  placeholder?: string;
  projectIds?: string[];
  styles?: {control?: (provided: any) => any};
};

type FilterOption<T> = {
  data: T;
  label: React.ReactNode;
  value: string;
};

/**
 * A component that allows you to select either members and/or teams
 */
function SelectMembers({
  'aria-label': ariaLabelProp,
  ariaLabel,
  disabled,
  onChange,
  onInputChange,
  organization,
  placeholder,
  projectIds,
  styles,
  value,
}: Props) {
  const api = useApi();
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<MentionableUser[] | null>(null);
  const {data: users = [], isPending: memberListLoading} = useOrganizationUsers({
    projectIds,
    select: selectUsersFromMembers,
  });

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
        id: user.id,
        name: user.name,
      },
    }),
    [renderUserBadge]
  );

  const createUnmentionableUser = useCallback(
    ({user}: Member & {user: User}) => ({
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

  const mentionableUsers = useMemo(
    () => users.map(createMentionableUser),
    [createMentionableUser, users]
  );

  const queryMembers = useMemo(
    () =>
      debounce((query: string, cb: (...args: [Error] | [null, Member[]]) => void) => {
        return api
          .requestPromise(`/organizations/${organization.slug}/members/`, {
            query: {query},
          })
          .then(
            data => cb(null, data),
            err => cb(err)
          );
      }, 250),
    [api, organization.slug]
  );

  useEffect(() => () => queryMembers.cancel(), [queryMembers]);

  const handleLoadOptions = (): Promise<MentionableUser[]> => {
    const usersInProjectById = mentionableUsers.map(({actor}) => actor.id);

    // Return a promise for `react-select`
    return new Promise<Member[]>((resolve, reject) => {
      queryMembers(inputValue, (...errOrResult) => {
        if (errOrResult[0]) {
          reject(errOrResult[0]);
        } else {
          resolve(errOrResult[1]);
        }
      });
    })
      .then(members =>
        // Be careful here as we actually want the `users` object, otherwise it means user
        // has not registered for sentry yet, but has been invited
        members
          ? members
              .filter(
                (member): member is Member & {user: User} =>
                  !!member.user && !usersInProjectById.includes(member.user.id)
              )
              .map(createUnmentionableUser)
          : []
      )
      .then(members => {
        const nextOptions = [...mentionableUsers, ...members];
        setOptions(nextOptions);
        return nextOptions;
      });
  };

  const handleInputChange = (nextInputValue: any) => {
    setInputValue(nextInputValue);
    onInputChange?.(nextInputValue);
  };

  // If memberList is still loading we need to disable a placeholder Select,
  // otherwise `react-select` will call `loadOptions` and prematurely load
  // options
  if (memberListLoading) {
    return <StyledSelectControl isDisabled placeholder={t('Loading')} />;
  }

  const currentOptions = options ?? mentionableUsers;

  return (
    <StyledSelectControl
      aria-label={ariaLabel ?? ariaLabelProp}
      filterOption={(option: FilterOption<MentionableUser>, filterText: string) =>
        option?.data?.searchKey?.indexOf(filterText) > -1
      }
      loadOptions={handleLoadOptions}
      defaultOptions={mentionableUsers}
      async
      isDisabled={disabled}
      cacheOptions={false}
      placeholder={placeholder}
      onInputChange={handleInputChange}
      onChange={onChange}
      value={currentOptions.find(option => option.value === value)}
      styles={{
        ...styles,
        option: (provided: any, state: any) => ({
          ...provided,

          svg: {
            color: state.isSelected && '#fff',
          },
        }),
      }}
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

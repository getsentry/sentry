import {useEffect} from 'react';

import {UserAvatar} from '@sentry/scraps/avatar';

import {t} from 'sentry/locale';
import {useMembers} from 'sentry/utils/useMembers';

import type {InputFieldProps} from './inputField';
import SelectField from './selectField';

export function SentryMemberSelectorField({
  placeholder = t('Choose a member'),
  multiple = false,
  ...props
}: InputFieldProps) {
  const {members, fetching, onSearch, loadMore} = useMembers();
  const memberOptions =
    members?.map(member => ({
      value: parseInt(member.id, 10),
      label: member.name,
      leadingItems: <UserAvatar user={member} />,
    })) ?? [];

  // We need to load some members initially
  // Otherwise we only get options when searching.
  useEffect(
    () => {
      loadMore();
    },
    // Only ensure things are loaded at mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <SelectField
      placeholder={placeholder}
      options={memberOptions}
      isLoading={fetching}
      onInputChange={(value: any) => {
        onSearch(value);
      }}
      multiple={multiple}
      {...props}
    />
  );
}

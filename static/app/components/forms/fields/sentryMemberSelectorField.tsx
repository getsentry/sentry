import {UserAvatar} from '@sentry/scraps/avatar';

import {t} from 'sentry/locale';
import {useOrganizationMemberSearch} from 'sentry/utils/members/useOrganizationMemberSearch';

import type {InputFieldProps} from './inputField';
import {SelectField} from './selectField';

export function SentryMemberSelectorField({
  placeholder = t('Choose a member'),
  multiple = false,
  ...props
}: InputFieldProps) {
  const {members, isPending, onSearch} = useOrganizationMemberSearch();
  const memberOptions =
    members?.map(member => ({
      value: parseInt(member.id, 10),
      label: member.name,
      leadingItems: <UserAvatar user={member} />,
    })) ?? [];

  return (
    <SelectField
      placeholder={placeholder}
      options={memberOptions}
      isLoading={isPending}
      onInputChange={(value: any) => {
        onSearch(value);
      }}
      multiple={multiple}
      {...props}
    />
  );
}

import {useContext, useMemo} from 'react';

import {FormContext} from 'sentry/components/forms/formContext';
import {t} from 'sentry/locale';
import {useOwnerOptions} from 'sentry/utils/useOwnerOptions';
import {useOwners} from 'sentry/utils/useOwners';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {SelectFieldProps} from './selectField';
import {SelectField} from './selectField';

// projects can be passed as a direct prop as well
interface RenderFieldProps extends SelectFieldProps<any> {
  avatarSize?: number;
  /**
   * Ensures the only selectable teams are members of the given project.
   */
  memberOfProjectSlugs?: string[];
  /**
   * Use the slug as the select field value. Without setting this the numeric id
   * of the project will be used.
   */
  valueIsSlug?: boolean;
}

export function SentryMemberTeamSelectorField({
  avatarSize = 20,
  placeholder = t('Choose Teams and Members'),
  memberOfProjectSlugs,
  ...props
}: RenderFieldProps) {
  const {form} = useContext(FormContext);
  const fieldValue = form?.getValue(props.name);

  // Coerce value to always be a list of items
  const currentValue = useMemo(
    () =>
      Array.isArray(fieldValue) ? fieldValue : fieldValue ? [fieldValue] : undefined,
    [fieldValue]
  );

  const {teams, members, fetching, onTeamSearch, onMemberSearch} = useOwners({
    currentValue,
  });
  const options = useOwnerOptions({
    teams,
    members,
    avatarProps: {size: avatarSize},
    memberOfProjectSlugs,
  });

  return (
    <SelectField
      placeholder={placeholder}
      allowClear
      onInputChange={(value: any) => {
        onMemberSearch(value);
        onTeamSearch(value);
      }}
      isLoading={fetching}
      options={options}
      {...props}
    />
  );
}

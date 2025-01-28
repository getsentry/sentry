import {useContext, useMemo} from 'react';

import {t} from 'sentry/locale';
import {useOwnerOptions} from 'sentry/utils/useOwnerOptions';
import {useOwners} from 'sentry/utils/useOwners';

import FormContext from '../formContext';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {SelectFieldProps} from './selectField';
import SelectField from './selectField';

// projects can be passed as a direct prop as well
export interface RenderFieldProps extends SelectFieldProps<any> {
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

function SentryMemberTeamSelectorField({
  avatarSize = 20,
  placeholder = t('Choose Teams and Members'),
  memberOfProjectSlugs,
  ...props
}: RenderFieldProps) {
  const {form} = useContext(FormContext);
  const {multiple} = props;
  const fieldValue = form?.getValue<string[] | null>(props.name, multiple ? [] : null);

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

export default SentryMemberTeamSelectorField;

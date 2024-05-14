import {ORG_ROLES} from 'sentry/constants';
import {t} from 'sentry/locale';

import type {InputFieldProps} from './inputField';
import SelectField from './selectField';

function SentryOrganizationRoleSelectorField({
  placeholder = t('Choose a role'),
  ...props
}: InputFieldProps) {
  const projectOptions = ORG_ROLES?.map(role => ({
    value: role.id,
    label: role.name,
  }));

  return <SelectField placeholder={placeholder} options={projectOptions} {...props} />;
}

export default SentryOrganizationRoleSelectorField;

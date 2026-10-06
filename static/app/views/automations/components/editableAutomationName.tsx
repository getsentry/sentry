import {useContext} from 'react';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import {FormContext} from 'sentry/components/forms/formContext';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useAutomationFormContext} from 'sentry/views/automations/components/forms/context';
import {makeAutomationBasePathname} from 'sentry/views/automations/pathnames';
import {TopBar} from 'sentry/views/navigation/topBar';

export function EditableAutomationName() {
  const organization = useOrganization();
  const {form} = useContext(FormContext);
  const value = useFormField<string>('name');
  const {setHasSetAutomationName} = useAutomationFormContext();

  return (
    <TopBar.Slot
      name="breadcrumbs"
      title={{
        type: 'editable-title',
        allowEmpty: true,
        value: value || '',
        onChange: newValue => {
          // Mark that the user has manually set the automation name
          setHasSetAutomationName(true);
          form?.setValue('name', newValue);
        },
        placeholder: t('New Alert'),
        'aria-label': t('Alert Name'),
      }}
    >
      <BreadcrumbList
        items={[
          {
            type: 'link',
            label: t('Alerts'),
            to: makeAutomationBasePathname(organization.slug),
          },
        ]}
      />
    </TopBar.Slot>
  );
}

import {useContext} from 'react';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import {FormContext} from 'sentry/components/forms/formContext';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {t} from 'sentry/locale';
import {useAutomationFormContext} from 'sentry/views/automations/components/forms/context';

export function EditableAutomationName() {
  const {form} = useContext(FormContext);
  const value = useFormField<string>('name');
  const {setHasSetAutomationName} = useAutomationFormContext();

  return (
    <BreadcrumbList.Title
      item={{
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
    />
  );
}

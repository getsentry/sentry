import {useContext} from 'react';

import {FormContext} from 'sentry/components/forms/formContext';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {t} from 'sentry/locale';
import {useAutomationFormContext} from 'sentry/views/automations/components/forms/context';
import {TopBar} from 'sentry/views/navigation/topBar';

export function EditableAutomationName({children}: {children?: React.ReactNode}) {
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
      {children}
    </TopBar.Slot>
  );
}

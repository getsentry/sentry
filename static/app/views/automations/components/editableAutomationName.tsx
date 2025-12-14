import EditableText from 'sentry/components/editableText';
import FormField from 'sentry/components/forms/formField';
import {t} from 'sentry/locale';
import {useAutomationFormContext} from 'sentry/views/automations/components/forms/context';

export function EditableAutomationName() {
  const {setHasSetAutomationName} = useAutomationFormContext();

  return (
    <FormField name="name" inline={false} flexibleControlStateSize stacked>
      {({onChange, value}) => (
        <EditableText
          allowEmpty
          value={value || ''}
          onChange={newValue => {
            // Mark that the user has manually set the automation name
            setHasSetAutomationName(true);
            onChange(newValue, {
              target: {
                value: newValue,
              },
            });
          }}
          placeholder={t('New Alert')}
        />
      )}
    </FormField>
  );
}

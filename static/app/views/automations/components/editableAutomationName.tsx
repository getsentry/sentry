import EditableText from 'sentry/components/editableText';
import FormField from 'sentry/components/forms/formField';
import {t} from 'sentry/locale';

export function EditableAutomationName() {
  return (
    <FormField name="name" inline={false} flexibleControlStateSize stacked>
      {({onChange, value}) => (
        <EditableText
          isDisabled={false}
          value={value || ''}
          onChange={newValue => {
            onChange(newValue, {
              target: {
                value: newValue,
              },
            });
          }}
          errorMessage={t('Please set a name for your automation.')}
          placeholder={t('New Automation')}
        />
      )}
    </FormField>
  );
}

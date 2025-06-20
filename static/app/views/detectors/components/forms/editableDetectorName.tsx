import EditableText from 'sentry/components/editableText';
import FormField from 'sentry/components/forms/formField';
import {t} from 'sentry/locale';

export function EditableDetectorName() {
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
          errorMessage={t('Please set a title')}
          placeholder={t('New Monitor')}
        />
      )}
    </FormField>
  );
}

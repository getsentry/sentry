import EditableText from 'sentry/components/editableText';
import FormField from 'sentry/components/forms/formField';
import {t} from 'sentry/locale';

export function EditableDetectorTitle() {
  return (
    <FormField name="title" inline={false} flexibleControlStateSize stacked>
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

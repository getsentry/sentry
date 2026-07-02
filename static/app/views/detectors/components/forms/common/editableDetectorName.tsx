import {EditableText} from 'sentry/components/editableText';
import {FormField} from 'sentry/components/forms/formField';
import {t} from 'sentry/locale';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';

export function EditableDetectorName() {
  const {setHasSetDetectorName} = useDetectorFormContext();

  return (
    <FormField name="name" inline={false} flexibleControlStateSize stacked>
      {({onChange, value}) => (
        <EditableText
          allowEmpty
          value={value || ''}
          onChange={newValue => {
            onChange(newValue, {
              target: {
                value: newValue,
              },
            });
            setHasSetDetectorName(true);
          }}
          placeholder={t('New Monitor')}
          aria-label={t('Monitor Name')}
          variant="compact"
        />
      )}
    </FormField>
  );
}

import {EditableText} from 'sentry/components/editableText';
import {FormField} from 'sentry/components/forms/formField';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';

export function DetectorNameField() {
  const {setHasSetDetectorName} = useDetectorFormContext();

  return (
    <Layout.Title>
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
          />
        )}
      </FormField>
    </Layout.Title>
  );
}

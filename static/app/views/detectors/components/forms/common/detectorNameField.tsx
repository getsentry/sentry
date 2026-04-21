import {EditableText} from 'sentry/components/editableText';
import {FormField} from 'sentry/components/forms/formField';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

export function DetectorNameField() {
  const {setHasSetDetectorName} = useDetectorFormContext();
  const hasPageFrame = useHasPageFrameFeature();

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
            variant={hasPageFrame ? 'compact' : undefined}
          />
        )}
      </FormField>
    </Layout.Title>
  );
}

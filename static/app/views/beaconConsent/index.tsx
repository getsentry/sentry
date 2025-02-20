import {useEffect} from 'react';

import ApiForm from 'sentry/components/forms/apiForm';
import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';
import RadioField from 'sentry/components/forms/fields/radioField';
import ExternalLink from 'sentry/components/links/externalLink';
import NarrowLayout from 'sentry/components/narrowLayout';
import {t, tct} from 'sentry/locale';

type Props = {
  onSubmitSuccess?: () => void;
};

function BeaconConsent({onSubmitSuccess}: Props) {
  useEffect(() => {
    document.body.classList.add('auth');

    return () => document.body.classList.remove('auth');
  }, []);

  return (
    <NarrowLayout>
      <ApiForm
        apiMethod="PUT"
        apiEndpoint="/internal/options/"
        onSubmitSuccess={onSubmitSuccess}
        submitLabel={t('Continue')}
      >
        <FieldWrapper stacked={false} hasControlState={false}>
          {t(
            'We have made some updates to our self-hosted beacon broadcast system, and just need to get a quick answer from you.'
          )}
        </FieldWrapper>
        <RadioField
          name="beacon.record_cpu_ram_usage"
          defaultValue={() => 'true'}
          choices={[
            [
              'true',
              t(
                'Yes, I would love to help Sentry developers improve the experience of self-hosted by sending CPU/RAM usage'
              ),
            ],
            ['false', t("No, I'd prefer to keep CPU/RAM usage private")],
          ]}
          label={t('CPU/RAM Usage')}
          required
          help={tct(
            `Recording CPU/RAM usage will greatly help our development team understand how self-hosted sentry
            is typically being used, and to keep track of improvements that we hope to bring you in the future.`,
            {link: <ExternalLink href="https://sentry.io/privacy/" />}
          )}
          inline={false}
        />
      </ApiForm>
    </NarrowLayout>
  );
}

export default BeaconConsent;

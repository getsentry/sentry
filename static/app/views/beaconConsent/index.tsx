import {useEffect} from 'react';

import ApiForm from 'sentry/components/forms/apiForm';
import FieldWrapper from 'sentry/components/forms/fieldGroup/fieldWrapper';
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
            'We have made some updates to our self-hosted beacon broadcast system, and we just need to get a quick answer from you.'
          )}
        </FieldWrapper>
        <RadioField
          name="beacon.record_cpu_ram_usage"
          choices={[
            ['true', t('Yes, I would like to send cpu/ram usage to sentry.io')],
            ['false', t("No, I'd prefer not to send cpu/ram usage to sentry.io")],
          ]}
          label={t('CPU/RAM Usage')}
          required
          help={tct(
            `We'd love to record your CPU/RAM usage as it would greatly help our development team understand how self-hosted sentry
            is being typically used, and to keep track of improvements that we hope to bring you in the future.`,
            {link: <ExternalLink href="https://sentry.io/privacy/" />}
          )}
          inline={false}
        />
      </ApiForm>
    </NarrowLayout>
  );
}

export default BeaconConsent;

import {Fragment} from 'react';

import Alert from 'sentry/components/alert';
import Input from 'sentry/components/forms/controls/input';
import Textarea from 'sentry/components/forms/controls/textarea';
import Field from 'sentry/components/forms/field';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';

import {StepOneData} from './types';

type Props = {
  onSetStepOneData: (stepOneData: StepOneData) => void;
  stepOneData: StepOneData;
};

function StepOne({stepOneData, onSetStepOneData}: Props) {
  return (
    <Fragment>
      <Alert type="info">
        {tct(
          'Please enter the [docLink:App Store Connect API Key] details. The key needs to have the "Developer" role for Sentry to discover the app builds.',
          {
            docLink: (
              <ExternalLink href="https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api" />
            ),
          }
        )}
      </Alert>
      <Field
        label={t('Issuer')}
        inline={false}
        error={stepOneData.errors?.issuer}
        flexibleControlStateSize
        stacked
        required
      >
        <Input
          type="text"
          name="issuer"
          placeholder={t('Issuer')}
          value={stepOneData.issuer}
          onChange={e =>
            onSetStepOneData({
              ...stepOneData,
              issuer: e.target.value,
              errors: !!stepOneData.errors
                ? {...stepOneData.errors, issuer: undefined}
                : undefined,
            })
          }
        />
      </Field>
      <Field
        label={t('Key ID')}
        inline={false}
        error={stepOneData.errors?.keyId}
        flexibleControlStateSize
        stacked
        required
      >
        <Input
          type="text"
          name="keyId"
          placeholder={t('Key Id')}
          value={stepOneData.keyId}
          onChange={e =>
            onSetStepOneData({
              ...stepOneData,
              keyId: e.target.value,
              errors: !!stepOneData.errors
                ? {...stepOneData.errors, keyId: undefined}
                : undefined,
            })
          }
        />
      </Field>
      <Field
        label={t('Private Key')}
        inline={false}
        flexibleControlStateSize
        stacked
        required
      >
        <Textarea
          name="privateKey"
          value={stepOneData.privateKey}
          rows={5}
          autosize
          placeholder={
            stepOneData.privateKey === undefined
              ? t('(Private Key unchanged)')
              : '-----BEGIN PRIVATE KEY-----\n[PRIVATE-KEY]\n-----END PRIVATE KEY-----'
          }
          onChange={e =>
            onSetStepOneData({
              ...stepOneData,
              privateKey: e.target.value,
            })
          }
        />
      </Field>
    </Fragment>
  );
}

export default StepOne;

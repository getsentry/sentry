import {Fragment} from 'react';

import Alert from 'app/components/alert';
import ExternalLink from 'app/components/links/externalLink';
import {t, tct} from 'app/locale';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';

import {StepThreeData} from './types';

type Props = {
  stepThreeData: StepThreeData;
  onSetStepOneData: (stepThreeData: StepThreeData) => void;
};

function StepThree({stepThreeData, onSetStepOneData}: Props) {
  return (
    <Fragment>
      <Alert type="info">
        {tct(
          'Please enter the iTunes credentials that Sentry should use to download dSYMs from App Store Connect. It is recommended to [docLink:create a new Apple ID] with the "Developer" role for this.',
          {
            docLink: <ExternalLink href="https://support.apple.com/en-us/HT204316" />,
          }
        )}
      </Alert>
      <Field
        label={t('Username')}
        inline={false}
        flexibleControlStateSize
        stacked
        required
      >
        <Input
          type="text"
          name="username"
          placeholder={t('Username')}
          value={stepThreeData.username}
          onChange={e => onSetStepOneData({...stepThreeData, username: e.target.value})}
        />
      </Field>
      <Field
        label={t('Password')}
        inline={false}
        flexibleControlStateSize
        stacked
        required
      >
        <Input
          name="password"
          type={stepThreeData.password === undefined ? 'text' : 'password'}
          value={stepThreeData.password}
          placeholder={
            stepThreeData.password === undefined
              ? t('(Password unchanged)')
              : t('Password')
          }
          onChange={e =>
            onSetStepOneData({
              ...stepThreeData,
              password: e.target.value,
            })
          }
        />
      </Field>
    </Fragment>
  );
}

export default StepThree;

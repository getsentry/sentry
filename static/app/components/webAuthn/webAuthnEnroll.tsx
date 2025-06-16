import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import FormField from 'sentry/components/forms/formField';
import type FormModel from 'sentry/components/forms/model';
import {t} from 'sentry/locale';
import type {ChallengeData} from 'sentry/types/auth';

import {handleEnroll} from './handlers';

interface WebAuthnEnrollProps {
  challengeData: ChallengeData;
}

const UNSUPPORTED_NOTICE = t(
  'Your browser does not support WebAuthn (passkey). You need to use a different two-factor method or switch to a browser that supports it (Google Chrome or Microsoft Edge)'
);

const FAILURE_MESSAGE = t('There was a problem enrolling, please try again.');

export function WebAuthnEnroll({challengeData}: WebAuthnEnrollProps) {
  const isSupported = !!window.PublicKeyCredential;
  const challenge = JSON.stringify(challengeData);

  const [activated, setActivated] = useState(false);

  const triggerEnroll = useCallback(
    async (model: FormModel) => {
      setActivated(false);
      model.setError('challenge', false);

      try {
        const webAuthnResponse = await handleEnroll(challengeData);

        if (!webAuthnResponse) {
          model.setError('challenge', FAILURE_MESSAGE);
          return;
        }

        setActivated(true);
        model.setValue('response', webAuthnResponse);
        model.setValue('challenge', challenge);
      } catch (err) {
        model.setError('challenge', FAILURE_MESSAGE);
        setActivated(false);
      }
    },
    [challenge, challengeData]
  );

  return (
    <FormField
      name="challenge"
      label={t('Enroll Device')}
      help={t('Enroll your Passkey, Security Key, or Biometric authenticator.')}
      required
      disabled={!isSupported}
      disabledReason={UNSUPPORTED_NOTICE}
      flexibleControlStateSize
    >
      {({model}) => (
        <EnrollButton
          onClick={() => triggerEnroll(model)}
          disabled={!isSupported || activated}
        >
          {model.getValue('response') ? t('Enrolled!') : t('Start Enrollment')}
        </EnrollButton>
      )}
    </FormField>
  );
}

const EnrollButton = styled(Button)`
  align-self: self-end;
`;

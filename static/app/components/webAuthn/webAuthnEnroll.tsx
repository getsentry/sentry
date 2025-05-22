import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {t} from 'sentry/locale';
import type {ChallengeData} from 'sentry/types/auth';

import {handleEnroll} from './handlers';

interface WebAuthnParams {
  challenge: string;
  response: string;
}

interface WebAuthnEnrollProps {
  challengeData: ChallengeData;
  /**
   * Callback for when the webAuthn flow is completed.
   */
  onWebAuthn?: (result: WebAuthnParams) => void;
}

const UNSUPPORTED_NOTICE = t(
  'Your browser does not support WebAuthn (passkey). You need to use a different two-factor method or switch to a browser that supports it (Google Chrome or Microsoft Edge)'
);

export function WebAuthnEnroll({onWebAuthn, challengeData}: WebAuthnEnrollProps) {
  const isSupported = !!window.PublicKeyCredential;
  const challenge = JSON.stringify(challengeData);

  const [activated, setActivated] = useState(false);
  const [failed, setFailed] = useState(false);

  const triggerEnroll = useCallback(async () => {
    setActivated(false);
    setFailed(false);

    try {
      const webAuthnResponse = await handleEnroll(challengeData);

      if (!webAuthnResponse) {
        setFailed(true);
        return;
      }

      setActivated(true);
      onWebAuthn?.({response: webAuthnResponse, challenge});
    } catch (err) {
      setFailed(true);
      setActivated(false);
    }
  }, [onWebAuthn, challenge, challengeData]);

  return (
    <FieldGroup
      label={t('Enroll Device')}
      disabled={!isSupported}
      disabledReason={UNSUPPORTED_NOTICE}
      flexibleControlStateSize
      error={failed && t('There was a problem enrolling, please try again.')}
    >
      <EnrollButton onClick={triggerEnroll} disabled={!isSupported || activated}>
        {t('Start Enrollment')}
      </EnrollButton>
    </FieldGroup>
  );
}

const EnrollButton = styled(Button)`
  align-self: self-end;
`;

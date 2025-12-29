import {useCallback, useEffect, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import noop from 'lodash/noop';

import deviceAnimation from 'sentry-images/spot/u2f-small.gif';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {ChallengeData} from 'sentry/types/auth';

import {handleSign} from './handlers';

interface WebAuthnParams {
  challenge: string;
  response: string;
}

export interface WebAuthnAssertProps {
  challengeData: ChallengeData;
  mode?: 'signin' | 'sudo';
  /**
   * Callback for when the webAuthn flow is completed.
   *
   * When this handler is not set, this component will submit the form this
   * component is within.
   */
  onWebAuthn?: (result: WebAuthnParams) => void;
}

type ResponseError = 'UNKNOWN_ERROR' | 'DEVICE_ERROR' | 'UNKNOWN_DEVICE' | 'BAD_APPID';

/**
 * Extracts response error from bubbled up API errors typically when making
 * API calls with the challenge response.
 */
function getResponseError(err: any): ResponseError {
  if (!err.metaData) {
    return 'DEVICE_ERROR';
  }

  if (err.metaData.type === 'BAD_REQUEST') {
    return 'BAD_APPID';
  }

  if (err.metaData.type === 'DEVICE_INELIGIBLE') {
    return 'UNKNOWN_DEVICE';
  }

  return 'UNKNOWN_ERROR';
}

const MESSAGES = {
  signin: t('Sign in with your passkey, biometrics, or security key.'),
  sudo: t('You can also confirm this action using your passkey.'),
};

export function WebAuthnAssert({
  onWebAuthn,
  challengeData,
  mode = 'signin',
}: WebAuthnAssertProps) {
  const isSupported = !!window.PublicKeyCredential;
  const challenge = JSON.stringify(challengeData);

  const inputRef = useRef<HTMLInputElement>(null);

  const [activated, setActivated] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<ResponseError | null>(null);

  const triggerWebAuthn = useCallback(async () => {
    setActivated(false);
    setError(null);

    try {
      const webAuthnResponse = await handleSign(challengeData);
      setResponse(webAuthnResponse);

      if (!webAuthnResponse) {
        setError('DEVICE_ERROR');
        return;
      }

      setActivated(true);
      onWebAuthn?.({response: webAuthnResponse, challenge});
    } catch (err) {
      // XXX(epurkhiser): Not a great interface, but we handle exceptions
      // bubbled up through the onWebAuthn handler. These typically come back
      // from the auth API.
      setError(getResponseError(err));
      setActivated(false);

      // we want to know what is happening here. There are some indicators that
      // users are getting errors that should not happen through the regular
      // webauthn flow.
      Sentry.captureException(err);
    }
  }, [onWebAuthn, challenge, challengeData]);

  // XXX(epurkhiser): Janky, but the way this component is implemented for
  // legacy reasons is that the parent form (not part of this component) is
  // submitted once the response is set.
  const shouldSubmitForm = !onWebAuthn && response !== null;

  useEffect(
    () => void (shouldSubmitForm && inputRef.current?.form?.submit()),
    [shouldSubmitForm]
  );

  // Trigger the webAuthn flow immediately
  useEffect(() => {
    if (!isSupported) {
      return noop;
    }

    // Trigger immedialtey if the browser has focus
    if (document.hasFocus()) {
      triggerWebAuthn();
      return noop;
    }

    // Trigger webauthn once the browser is focused. Browsers like safari do
    // not like it if the navigator.credentials APIs are used without focus.
    window.addEventListener('focus', triggerWebAuthn, {once: true});
    return () => window.removeEventListener('focus', triggerWebAuthn);
  }, [isSupported, triggerWebAuthn]);

  if (!isSupported && mode === 'sudo') {
    return null;
  }

  if (!isSupported) {
    return <UnsupportedError />;
  }

  if (error) {
    return <AuthenticatorError error={error} triggerWebAuthn={triggerWebAuthn} />;
  }

  return (
    <Container>
      <DeviceAnimation activated={activated} role="presentation" />
      {MESSAGES[mode]}

      <input type="hidden" name="challenge" value={challenge} />
      <input type="hidden" name="response" value={response ?? ''} ref={inputRef} />
    </Container>
  );
}

interface AuthenticatorErrorProps {
  error: ResponseError;
  triggerWebAuthn: () => void;
}

function AuthenticatorError({error, triggerWebAuthn}: AuthenticatorErrorProps) {
  const supportEmail = ConfigStore.get('supportEmail');

  const errorMessages: Record<ResponseError, React.ReactNode> = {
    UNKNOWN_ERROR: t('There was an unknown problem, please try again.'),
    DEVICE_ERROR: t('Your authentication reported an error.'),
    UNKNOWN_DEVICE: t('The device or passkey you used for sign-in is unknown.'),
    BAD_APPID: tct(
      'The Sentry server administrator modified the device registrations. You need to remove and re-add the device or passkey. Use a different sign-in method or contact [supportEmail:support] for assistance.',
      {
        supportEmail: <ExternalLink href={`mailTo:${supportEmail}`} />,
      }
    ),
  };

  const retry = (
    <Button size="xs" onClick={triggerWebAuthn}>
      {t('Try Again')}
    </Button>
  );

  return (
    <Container>
      <Alert variant="danger" trailingItems={retry}>
        {errorMessages[error]}
      </Alert>
    </Container>
  );
}

function UnsupportedError() {
  return (
    <Container>
      <Alert variant="warning">
        {t(
          'Your browser does not support WebAuthn (passkey). You need to use a different two-factor method or switch to a browser that supports it (Google Chrome or Microsoft Edge).'
        )}
      </Alert>
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  align-items: center;
  padding: ${space(3)} 0;
  margin-bottom: ${space(2)};
`;

const DeviceAnimation = styled('div')<{activated: boolean}>`
  height: 100px;
  width: 100px;
  border-radius: 50%;
  background-image: url(${deviceAnimation});
  background-size: 100px;
  border: 1px solid ${p => p.theme.border};
  ${p =>
    p.activated &&
    css`
      filter: blur(8px);
      transition: filter 300ms ease;
    `};
`;

// XXX(epurkhiser): We are ONLY exporting this as default for the
// processInitQueue COMPONENT_MAP
const DO_NOT_USE_WebAuthnAssert = WebAuthnAssert;
export default DO_NOT_USE_WebAuthnAssert;

import {useEffect, useEffectEvent, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {handleSign} from 'sentry/components/webAuthn/handlers';
import {t} from 'sentry/locale';
import {
  type WebAuthnResponse,
  useSecondFactorChallenge,
} from 'sentry/views/authV2/authLogin/hooks/useSecondFactorAuth';

interface WebAuthn2FAMethodProps {
  isActive: boolean;
  isProcessing: boolean;
  onRetrySubmission: () => void;
  onSubmit: (response: WebAuthnResponse) => void;
  submissionFailed: boolean;
}

type WebAuthnError = 'unsupported' | 'failed';

export function WebAuthn2FAMethod({
  isActive,
  isProcessing,
  onRetrySubmission,
  onSubmit,
  submissionFailed,
}: WebAuthn2FAMethodProps) {
  const challenge = useSecondFactorChallenge();
  const {activate, reset} = challenge;
  const [hasActivated, setHasActivated] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<WebAuthnError | null>(null);
  const submitResponse = useEffectEvent(onSubmit);

  useEffect(() => {
    if (!isActive || hasActivated) {
      return;
    }

    setHasActivated(true);
    activate('u2f');
  }, [activate, hasActivated, isActive]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    return () => {
      reset();
      setHasActivated(false);
    };
  }, [isActive, reset]);

  useEffect(() => {
    if (!isActive || challenge.result?.method !== 'u2f') {
      return;
    }

    setError(null);

    if (!window.PublicKeyCredential) {
      setError('unsupported');
      return;
    }

    const webAuthnChallenge = challenge.result.challenge;
    let cancelled = false;

    async function authenticate() {
      try {
        const response = await handleSign(webAuthnChallenge);

        if (cancelled) {
          return;
        }

        if (!response) {
          setError('failed');
          return;
        }

        submitResponse(JSON.parse(response) as WebAuthnResponse);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        Sentry.captureException(caughtError);
        setError('failed');
      }
    }

    void authenticate();

    return () => {
      cancelled = true;
    };
  }, [attempt, challenge.result, isActive]);

  const errorMessage = challenge.errorMessage
    ? challenge.errorMessage
    : error === 'unsupported'
      ? t('This browser does not support passkey authentication.')
      : error === 'failed'
        ? t('Passkey authentication was unsuccessful.')
        : null;

  if (errorMessage || submissionFailed) {
    const retry = submissionFailed
      ? () => {
          onRetrySubmission();
          challenge.reset();
          setHasActivated(false);
        }
      : challenge.errorMessage
        ? () => {
            challenge.reset();
            setHasActivated(false);
          }
        : error === 'failed'
          ? () => {
              setError(null);
              setAttempt(value => value + 1);
            }
          : undefined;

    return (
      <Stack gap="sm" align="center">
        {errorMessage && (
          <Text as="p" variant="danger" align="center">
            {errorMessage}
          </Text>
        )}
        {retry && (
          <Button disabled={isProcessing} size="xs" variant="transparent" onClick={retry}>
            {t('Try again')}
          </Button>
        )}
      </Stack>
    );
  }

  return (
    <Text as="p" align="center">
      {t('Waiting for passkey, biometric, or hardware key authentication...')}
    </Text>
  );
}

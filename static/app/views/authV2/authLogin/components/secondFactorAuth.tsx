import {Activity, useEffect, useEffectEvent, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {OTPInput} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {handleSign} from 'sentry/components/webAuthn/handlers';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {unreachable} from 'sentry/utils/unreachable';
import {
  type SecondFactorAuthResult,
  type SecondFactorCredentials,
  type WebAuthnResponse,
  useCancelSecondFactorAuth,
  useSecondFactorAuth,
  useSecondFactorChallenge,
  useSecondFactorMethods,
} from 'sentry/views/authV2/authLogin/hooks/useSecondFactorAuth';
import type {MfaMethod} from 'sentry/views/authV2/authLogin/types';

const SECOND_FACTOR_PRIORITY = [
  'u2f',
  'totp',
  'sms',
  'recovery',
] as const satisfies ReadonlyArray<MfaMethod['id']>;

interface SecondFactorAuthProps {
  onBack: () => void;
  onComplete: (result: SecondFactorAuthResult) => void;
  methods?: MfaMethod[];
}

const METHOD_LABELS: Record<MfaMethod['id'], string> = {
  u2f: t('Passkey, biometric, hardware key'),
  totp: t('Authenticator app'),
  sms: t('Text message'),
  recovery: t('Recovery code'),
};

const USE_METHOD_LABELS: Record<MfaMethod['id'], string> = {
  u2f: t('Use passkey'),
  totp: t('Use authenticator'),
  sms: t('Use SMS code'),
  recovery: t('Use recovery code'),
};

export function SecondFactorAuth({
  methods: providedMethods,
  onBack,
  onComplete,
}: SecondFactorAuthProps) {
  const methodsQuery = useSecondFactorMethods(providedMethods === undefined);
  const methods = providedMethods ?? methodsQuery.data?.mfaMethods ?? [];
  const sortedMethods = SECOND_FACTOR_PRIORITY.flatMap(id =>
    methods.some(method => method.id === id) ? [{id} satisfies MfaMethod] : []
  );
  const [selectedMethod, setSelectedMethod] = useState<MfaMethod['id']>();
  const activeMethod = sortedMethods.some(method => method.id === selectedMethod)
    ? selectedMethod
    : sortedMethods[0]?.id;
  const auth = useSecondFactorAuth();
  const cancellation = useCancelSecondFactorAuth();
  const isInteractionDisabled = auth.isPending || cancellation.isPending;

  useEffect(() => {
    if (auth.result) {
      onComplete(auth.result);
    }
  }, [auth.result, onComplete]);

  if (providedMethods === undefined && methodsQuery.isPending) {
    return <Text variant="muted">{t('Loading authentication methods...')}</Text>;
  }

  if ((providedMethods === undefined && methodsQuery.isError) || !activeMethod) {
    return (
      <Alert.Container>
        <Alert variant="danger" showIcon={false}>
          {t('Unable to load authentication methods. Return to login and try again.')}
        </Alert>
      </Alert.Container>
    );
  }

  const otherMethods = sortedMethods.filter(method => method.id !== activeMethod);
  const onlyOtherMethod = otherMethods.length === 1 ? otherMethods[0] : undefined;
  const selectMethod = (method: MfaMethod['id']) => {
    auth.reset();
    setSelectedMethod(method);
  };

  return (
    <Stack gap="lg">
      {(auth.errorMessage || cancellation.errorMessage) && (
        <Alert.Container>
          <Alert variant="danger" showIcon={false}>
            {cancellation.errorMessage ?? auth.errorMessage}
          </Alert>
        </Alert.Container>
      )}

      {sortedMethods.map(method => (
        <Activity
          key={method.id}
          mode={method.id === activeMethod ? 'visible' : 'hidden'}
        >
          <MethodInput
            method={method.id}
            isActive={method.id === activeMethod}
            isDisabled={isInteractionDisabled}
            resetKey={auth.errorMessage}
            onAuthenticate={auth.authenticate}
          />
        </Activity>
      ))}

      <Flex align="center" justify="between">
        <Button
          variant="transparent"
          size="xs"
          icon={<IconArrow direction="left" />}
          busy={cancellation.isPending}
          disabled={auth.isPending}
          onClick={() => cancellation.cancel(undefined, {onSuccess: onBack})}
        >
          {t('Back to Login')}
        </Button>
        {otherMethods.length > 1 ? (
          <DropdownMenu
            size="xs"
            triggerLabel={t('Use Different Method')}
            triggerProps={{
              disabled: isInteractionDisabled,
              size: 'xs',
              variant: 'transparent',
            }}
            items={otherMethods.map(method => ({
              key: method.id,
              label: METHOD_LABELS[method.id],
              onAction: () => selectMethod(method.id),
            }))}
          />
        ) : onlyOtherMethod ? (
          <Button
            size="xs"
            variant="transparent"
            disabled={isInteractionDisabled}
            onClick={() => selectMethod(onlyOtherMethod.id)}
          >
            {USE_METHOD_LABELS[onlyOtherMethod.id]}
          </Button>
        ) : null}
      </Flex>
    </Stack>
  );
}

interface MethodInputProps {
  isActive: boolean;
  isDisabled: boolean;
  method: MfaMethod['id'];
  onAuthenticate: (credentials: SecondFactorCredentials) => void;
  resetKey: string | null;
}

function MethodInput({
  isActive,
  isDisabled,
  method,
  onAuthenticate,
  resetKey,
}: MethodInputProps) {
  switch (method) {
    case 'u2f':
      return (
        <WebAuthnMethodInput
          isActive={isActive && !isDisabled}
          onSubmit={response => onAuthenticate({method, response})}
        />
      );
    case 'sms':
      return (
        <SmsMethodInput
          isDisabled={isDisabled}
          isActive={isActive && !isDisabled}
          onSubmit={otp => onAuthenticate({method, otp})}
          resetKey={resetKey}
        />
      );
    case 'recovery':
      return (
        <Stack gap="md" align="center">
          <Text as="p">{t('Enter a one-time-use recovery code')}</Text>
          <OTPInput
            key={resetKey}
            disabled={isDisabled}
            format="AAAA-AAAA"
            onComplete={otp => onAuthenticate({method, otp})}
            uppercase
          />
        </Stack>
      );
    case 'totp':
      return (
        <Stack gap="md" align="center">
          <Text as="p">{t('Enter the code from your Authenticator')}</Text>
          <OTPInput
            key={resetKey}
            disabled={isDisabled}
            format="000000"
            onComplete={otp => onAuthenticate({method, otp})}
          />
        </Stack>
      );
    default:
      return unreachable(method);
  }
}

interface SmsMethodInputProps {
  isActive: boolean;
  isDisabled: boolean;
  onSubmit: (otp: string) => void;
  resetKey: string | null;
}

function SmsMethodInput({isActive, isDisabled, onSubmit, resetKey}: SmsMethodInputProps) {
  const challenge = useSecondFactorChallenge();
  const {activate} = challenge;
  const [hasActivated, setHasActivated] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!isActive || hasActivated) {
      return;
    }

    setHasActivated(true);
    activate('sms');
  }, [activate, hasActivated, isActive]);

  useEffect(() => {
    if (challenge.result?.method !== 'sms') {
      return;
    }

    const expiresAt = challenge.result.activatedAt + challenge.result.expiresIn * 1000;
    const updateCooldown = () => {
      setResendCooldown(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };

    updateCooldown();
    const interval = window.setInterval(() => {
      updateCooldown();
    }, 1000);

    return () => window.clearInterval(interval);
  }, [challenge.result]);

  const smsChallenge = challenge.result?.method === 'sms' ? challenge.result : null;

  return (
    <Stack gap="md" align="center">
      {challenge.isPending || (!smsChallenge && !challenge.errorMessage) ? (
        <Text as="p">{t('Sending SMS second factor code...')}</Text>
      ) : challenge.errorMessage ? (
        <Alert.Container>
          <Alert variant="danger" showIcon={false}>
            {challenge.errorMessage}
          </Alert>
        </Alert.Container>
      ) : (
        <Text as="p">
          {tct('A code has been sent by text message. [resend]', {
            resend: (
              <Button
                disabled={isDisabled || resendCooldown > 0}
                size="zero"
                variant="transparent"
                onClick={() => challenge.activate('sms')}
              >
                {resendCooldown > 0
                  ? tct('Resend ([seconds])', {seconds: resendCooldown})
                  : t('Resend')}
              </Button>
            ),
          })}
        </Text>
      )}
      <OTPInput
        key={resetKey}
        disabled={isDisabled || !smsChallenge}
        format="000000"
        onComplete={onSubmit}
      />
    </Stack>
  );
}

interface WebAuthnMethodInputProps {
  isActive: boolean;
  onSubmit: (response: WebAuthnResponse) => void;
}

type WebAuthnError = 'unsupported' | 'failed';

function WebAuthnMethodInput({isActive, onSubmit}: WebAuthnMethodInputProps) {
  const challenge = useSecondFactorChallenge();
  const {activate} = challenge;
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

  if (errorMessage) {
    const retry = challenge.errorMessage
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
        <Text as="p" variant="danger" align="center">
          {errorMessage}
        </Text>
        {retry && (
          <Button size="xs" variant="transparent" onClick={retry}>
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

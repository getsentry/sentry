import {useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import {motion} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {AnimatedActivity} from 'sentry/components/animatedActivity';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {useDimensions} from 'sentry/utils/useDimensions';
import {
  type SecondFactorAuthResult,
  type SecondFactorCredentials,
  useCancelSecondFactorAuth,
  useSecondFactorAuth,
  useSecondFactorMethods,
} from 'sentry/views/authV2/authLogin/hooks/useSecondFactorAuth';
import type {MfaMethod} from 'sentry/views/authV2/authLogin/types';

import {Recovery2FAMethod} from './recovery2faMethod';
import {Sms2FAMethod} from './sms2faMethod';
import {Totp2FAMethod} from './totp2faMethod';
import {WebAuthn2FAMethod} from './webAuthn2faMethod';

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

const METHOD_INITIAL = {opacity: 0, x: -10};
const METHOD_ANIMATE = {opacity: 1, x: 0};
const METHOD_EXIT = {opacity: 0, x: 10};

export function SecondFactorAuth({
  methods: providedMethods,
  onBack,
  onComplete,
}: SecondFactorAuthProps) {
  const theme = useTheme();
  const [methodElement, setMethodElement] = useState<HTMLDivElement | null>(null);
  const methodElementRef = useMemo(() => ({current: methodElement}), [methodElement]);
  const {height: methodHeight} = useDimensions({elementRef: methodElementRef});
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
  const isProcessing = auth.isPending || Boolean(auth.result) || cancellation.isPending;
  const authenticate = (credentials: SecondFactorCredentials) => {
    cancellation.reset();
    auth.authenticate(credentials);
  };

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

      <MotionContainer
        initial={false}
        animate={methodHeight ? {height: methodHeight} : undefined}
        transition={theme.motion.framer.spring.moderate}
      >
        <Grid columns="1fr" position="relative">
          {/* Preserve each method's local state across switches. Remounting the SMS
              method would automatically request another challenge. */}
          {sortedMethods.map(method => {
            const isActive = method.id === activeMethod;

            return (
              <AnimatedActivity
                key={method.id}
                mode={isActive ? 'visible' : 'hidden'}
                layoutMode="pop"
                elementRef={isActive ? setMethodElement : undefined}
                initial={METHOD_INITIAL}
                animate={METHOD_ANIMATE}
                exit={METHOD_EXIT}
                transition={theme.motion.framer.smooth.moderate}
              >
                <MethodInput
                  method={method.id}
                  isActive={isActive}
                  isProcessing={isProcessing}
                  resetKey={auth.errorMessage}
                  onAuthenticate={authenticate}
                  onResetAuthentication={auth.reset}
                />
              </AnimatedActivity>
            );
          })}
        </Grid>
      </MotionContainer>

      <Stack gap="3xl">
        <Flex align="center" justify="between">
          <Button
            variant="transparent"
            size="xs"
            icon={<IconArrow direction="left" />}
            busy={cancellation.isPending}
            disabled={isProcessing}
            onClick={() => cancellation.cancel(undefined, {onSuccess: onBack})}
          >
            {t('Back to Login')}
          </Button>
          {otherMethods.length > 1 ? (
            <DropdownMenu
              size="xs"
              triggerLabel={t('Use Different Method')}
              triggerProps={{
                disabled: isProcessing,
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
              disabled={isProcessing}
              onClick={() => selectMethod(onlyOtherMethod.id)}
            >
              {USE_METHOD_LABELS[onlyOtherMethod.id]}
            </Button>
          ) : null}
        </Flex>

        <Text as="p" align="center" size="sm" variant="muted">
          {tct('Having trouble logging in? [support:Contact support].', {
            support: <ExternalLink href="https://www.sentry.help/" />,
          })}
        </Text>
      </Stack>
    </Stack>
  );
}

interface MethodInputProps {
  isActive: boolean;
  isProcessing: boolean;
  method: MfaMethod['id'];
  onAuthenticate: (credentials: SecondFactorCredentials) => void;
  onResetAuthentication: () => void;
  resetKey: string | null;
}

function MethodInput({
  isActive,
  isProcessing,
  method,
  onAuthenticate,
  onResetAuthentication,
  resetKey,
}: MethodInputProps) {
  switch (method) {
    case 'u2f':
      return (
        <WebAuthn2FAMethod
          isActive={isActive}
          isProcessing={isProcessing}
          submissionFailed={Boolean(resetKey)}
          onRetrySubmission={onResetAuthentication}
          onSubmit={response => onAuthenticate({method, response})}
        />
      );
    case 'sms':
      return (
        <Sms2FAMethod
          isActive={isActive && !isProcessing}
          isProcessing={isProcessing}
          onSubmit={otp => onAuthenticate({method, otp})}
          resetKey={resetKey}
        />
      );
    case 'recovery':
      return (
        <Recovery2FAMethod
          isProcessing={isProcessing}
          resetKey={resetKey}
          onSubmit={otp => onAuthenticate({method, otp})}
        />
      );
    case 'totp':
      return (
        <Totp2FAMethod
          isProcessing={isProcessing}
          resetKey={resetKey}
          onSubmit={otp => onAuthenticate({method, otp})}
        />
      );
  }
}

const MotionContainer = motion.create(Container);

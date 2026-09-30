import {useState} from 'react';
import {useTheme} from '@emotion/react';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import type {AuthConfig} from 'sentry/types/auth';
import {AccountAuthentication} from 'sentry/views/authV2/authLogin/components/accountAuthentication';
import type {AuthenticatedResult, MfaMethod} from 'sentry/views/authV2/authLogin/types';
import {RegistrationForm} from 'sentry/views/authV2/authRegister/registrationForm';

interface InvitationAuthenticationProps {
  onAuthenticated: (result: AuthenticatedResult) => void;
  authConfig?: AuthConfig;
  initialEmail?: string;
}

export function InvitationAuthentication({
  authConfig,
  initialEmail = '',
  onAuthenticated,
}: InvitationAuthenticationProps) {
  const theme = useTheme();
  const [mode, setMode] = useState<'register' | 'sign-in'>('register');
  const [mfaMethods, setMfaMethods] = useState<MfaMethod[] | null>();
  const pendingMfaMethods =
    mfaMethods === undefined
      ? authConfig?.pendingMfa?.mfaMethods
      : (mfaMethods ?? undefined);
  const activeMode = pendingMfaMethods ? 'sign-in' : mode;

  return (
    <AnimatePresence initial={false} mode="wait">
      <MotionStack
        key={`${activeMode}-${pendingMfaMethods ? 'mfa' : 'form'}`}
        gap="lg"
        initial={{opacity: 0, y: -10}}
        animate={{opacity: 1, y: 0}}
        exit={{opacity: 0, y: 10}}
        transition={theme.motion.framer.smooth.moderate}
      >
        {activeMode === 'register' ? (
          <RegistrationForm
            hasNewsletter={authConfig?.hasNewsletter ?? false}
            initialEmail={initialEmail}
            onSuccess={onAuthenticated}
            secondaryAction={
              <Text as="div" align="center" size="sm">
                {tct('Have an account? [signin:Sign in]', {
                  signin: (
                    <Button
                      aria-label={t('Sign in')}
                      variant="link"
                      size="zero"
                      onClick={() => setMode('sign-in')}
                    />
                  ),
                })}
              </Text>
            }
          />
        ) : (
          <Stack gap="lg">
            <AccountAuthentication
              authConfig={authConfig}
              mfaMethods={pendingMfaMethods}
              onAuthenticated={onAuthenticated}
              onCancelMfa={() => {
                setMfaMethods(null);
                setMode('sign-in');
              }}
              onMfaRequired={setMfaMethods}
            />
            {!pendingMfaMethods && (
              <Text as="div" align="center" size="sm">
                {tct("Don't have an account? [create:Create one]", {
                  create: (
                    <Button
                      aria-label={t('Create one')}
                      variant="link"
                      size="zero"
                      onClick={() => setMode('register')}
                    />
                  ),
                })}
              </Text>
            )}
          </Stack>
        )}
      </MotionStack>
    </AnimatePresence>
  );
}

const MotionStack = motion.create(Stack);

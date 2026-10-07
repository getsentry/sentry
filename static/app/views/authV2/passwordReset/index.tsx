import {useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import {useQuery} from '@tanstack/react-query';
import {AnimatePresence, motion} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {useBrandedAuthLoading} from 'sentry/views/authV2/useBrandedAuthLoading';

import {PasswordResetForm} from './passwordResetForm';

export default function PasswordReset() {
  const theme = useTheme();
  const {userId, token} = useParams<{token: string; userId: string}>();
  const [isComplete, setComplete] = useState(false);
  const [isTokenInvalid, setTokenInvalid] = useState(false);
  const validation = useQuery({
    ...apiOptions.as<{valid: boolean}>()('/auth/recovery/confirm/', {
      query: {userId, token},
      staleTime: 0,
    }),
    enabled: !isComplete && !isTokenInvalid,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useBrandedAuthLoading(validation.isPending);

  if (validation.isPending) {
    return null;
  }

  return (
    <Stack width="100%" maxWidth="360px" gap="2xl">
      <SentryDocumentTitle title={t('Reset Password')} />
      <Heading as="h1" size="3xl" align="center">
        {t('Reset Password')}
      </Heading>
      <AnimatePresence initial={false} mode="wait">
        <MotionContent
          key={isComplete ? 'complete' : 'reset'}
          width="100%"
          initial={{opacity: 0, y: 8}}
          animate={{opacity: 1, y: 0}}
          exit={{opacity: 0, y: -8}}
          transition={theme.motion.framer.smooth.moderate}
        >
          {isComplete ? (
            <PasswordResetSuccess />
          ) : isTokenInvalid || validation.data?.valid === false ? (
            <Stack gap="lg">
              <Alert variant="warning">
                {t(
                  'This password reset link is invalid or expired. Request a new link to continue.'
                )}
              </Alert>
              <Flex>
                <LinkButton
                  to="/auth/login/"
                  size="xs"
                  variant="transparent"
                  icon={<IconArrow direction="left" />}
                >
                  {t('Back to sign in')}
                </LinkButton>
              </Flex>
            </Stack>
          ) : validation.error ? (
            <Stack gap="lg">
              <Alert variant="danger">
                {getRequestErrorUserMessage(
                  validation.error,
                  t('Unable to check this password reset link. Try again.')
                )}
              </Alert>
              <Button
                busy={validation.isFetching}
                disabled={validation.isFetching}
                onClick={() => validation.refetch()}
              >
                {t('Try again')}
              </Button>
            </Stack>
          ) : (
            <PasswordResetForm
              userId={userId}
              token={token}
              onSuccess={() => setComplete(true)}
              onInvalidToken={() => setTokenInvalid(true)}
            />
          )}
        </MotionContent>
      </AnimatePresence>
    </Stack>
  );
}

function PasswordResetSuccess() {
  const navigate = useNavigate();
  const [secondsRemaining, setSecondsRemaining] = useState(3);

  useEffect(() => {
    if (secondsRemaining === 0) {
      navigate('/auth/login/', {replace: true});
      return;
    }

    const timeout = window.setTimeout(
      () => setSecondsRemaining(secondsRemaining - 1),
      1000
    );
    return () => window.clearTimeout(timeout);
  }, [navigate, secondsRemaining]);

  return (
    <Stack gap="lg">
      <Text align="center">{t('Your password has been reset.')}</Text>
      <Text align="center" variant="muted">
        {t('Taking you back to sign in (%s)…', secondsRemaining)}
      </Text>
    </Stack>
  );
}

const MotionContent = motion.create(Stack);

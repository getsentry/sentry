import {useEffect, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {OTPInput} from '@sentry/scraps/input';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {useSecondFactorChallenge} from 'sentry/views/authV2/authLogin/hooks/useSecondFactorAuth';

interface Sms2FAMethodProps {
  isActive: boolean;
  isProcessing: boolean;
  onSubmit: (otp: string) => void;
  resetKey: string | null;
}

export function Sms2FAMethod({
  isActive,
  isProcessing,
  onSubmit,
  resetKey,
}: Sms2FAMethodProps) {
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
        <Stack gap="sm" align="center">
          <Alert.Container>
            <Alert variant="danger" showIcon={false}>
              {challenge.errorMessage}
            </Alert>
          </Alert.Container>
          <Button
            analyticsEventKey="auth.login.retry_clicked"
            analyticsEventName="Auth: Login Retry Clicked"
            analyticsParams={{stage: 'mfa_challenge', method: 'sms'}}
            disabled={isProcessing}
            size="xs"
            variant="transparent"
            onClick={() => challenge.activate('sms')}
          >
            {t('Try again')}
          </Button>
        </Stack>
      ) : (
        <Text as="p">
          {tct('A code has been sent by text message. [resend]', {
            resend: (
              <Button
                analyticsEventKey="auth.login.mfa_challenge_requested"
                analyticsEventName="Auth: MFA Challenge Requested"
                analyticsParams={{method: 'sms', request: 'resend'}}
                disabled={isProcessing || resendCooldown > 0}
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
        disabled={isProcessing || !smsChallenge}
        format="000000"
        onComplete={onSubmit}
      />
    </Stack>
  );
}

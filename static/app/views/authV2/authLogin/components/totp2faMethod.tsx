import {OTPInput} from '@sentry/scraps/input';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

interface Totp2FAMethodProps {
  isProcessing: boolean;
  onSubmit: (otp: string) => void;
  resetKey: string | null;
}

export function Totp2FAMethod({isProcessing, onSubmit, resetKey}: Totp2FAMethodProps) {
  return (
    <Stack gap="md" align="center">
      <Text as="p">{t('Enter the code from your Authenticator')}</Text>
      <OTPInput
        key={resetKey}
        disabled={isProcessing}
        format="000000"
        onComplete={onSubmit}
      />
    </Stack>
  );
}

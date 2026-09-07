import {OTPInput} from '@sentry/scraps/input';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

interface Recovery2FAMethodProps {
  isProcessing: boolean;
  onSubmit: (otp: string) => void;
  resetKey: string | null;
}

export function Recovery2FAMethod({
  isProcessing,
  onSubmit,
  resetKey,
}: Recovery2FAMethodProps) {
  return (
    <Stack gap="md" align="center">
      <Text as="p">{t('Enter a one-time-use recovery code')}</Text>
      <OTPInput
        key={resetKey}
        disabled={isProcessing}
        format="AAAA-AAAA"
        onComplete={onSubmit}
        uppercase
      />
    </Stack>
  );
}

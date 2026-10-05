import {lazy, Suspense} from 'react';
import {useDebouncedValue} from '@tanstack/react-pacer';

import {ProgressRing} from 'sentry/components/progressRing';
import {t} from 'sentry/locale';

const PasswordStrengthRing = lazy(() =>
  import('sentry/components/passwordStrength').then(module => ({
    default: module.PasswordStrengthRing,
  }))
);

export function PasswordStrengthIndicator({value}: {value: string}) {
  const [debouncedPassword] = useDebouncedValue(value, {wait: 100});

  return (
    <Suspense
      fallback={
        <ProgressRing
          role="progressbar"
          aria-label={t('Password strength')}
          aria-valuenow={0}
          aria-valuemin={0}
          aria-valuemax={5}
          aria-valuetext={t('No password entered')}
          value={0}
          maxValue={5}
          size={18}
        />
      }
    >
      <PasswordStrengthRing value={debouncedPassword} />
    </Suspense>
  );
}

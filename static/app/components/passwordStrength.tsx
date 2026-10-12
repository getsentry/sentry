import {css, useTheme, type Theme} from '@emotion/react';
// @ts-expect-error TS(7016): Could not find a declaration file for module 'zxcv... Remove this comment to see the full error message
import zxcvbn from 'zxcvbn';

import {ProgressRing} from 'sentry/components/progressRing';
import {t} from 'sentry/locale';

/**
 * The maximum score that zxcvbn reports
 */
const MAX_SCORE = 5;

type Props = {
  /**
   * The password value.
   */
  value: string;
};

/** @public */
export function PasswordStrengthRing({value}: Props) {
  const theme = useTheme();
  const strength = getPasswordStrength(value, theme);
  const label = strength?.label ?? t('No password entered');

  return (
    <ProgressRing
      role="progressbar"
      aria-label={t('Password strength')}
      aria-valuenow={strength ? strength.score + 1 : 0}
      aria-valuemin={0}
      aria-valuemax={MAX_SCORE}
      aria-valuetext={label}
      value={strength ? strength.score + 1 : 0}
      maxValue={MAX_SCORE}
      progressColor={strength?.color}
      text={strength?.grade}
      textCss={() => css`
        font-family: ${theme.font.family.mono};
        font-size: 9px;
        font-weight: 700;
      `}
      size={18}
      animate
    />
  );
}

function getPasswordStrength(value: string, theme: Theme) {
  if (!value) {
    return null;
  }

  const result = zxcvbn(value);
  if (!result) {
    return null;
  }

  const score = result.score as 0 | 1 | 2 | 3 | 4;
  const colors = [
    theme.colors.red400,
    theme.colors.red400,
    theme.colors.yellow400,
    theme.colors.green400,
    theme.colors.green400,
  ] as const;
  const labels = [
    t('Very Weak'),
    t('Very Weak'),
    t('Weak'),
    t('Strong'),
    t('Very Strong'),
  ] as const;
  const grades = ['F', 'D', 'C', 'B', 'A'] as const;

  return {
    score,
    color: colors[score],
    grade: grades[score],
    label: labels[score],
  };
}

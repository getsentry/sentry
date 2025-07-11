import {t} from 'sentry/locale';

export const MAX_REPOS_LIMIT = 8;

export const SEER_THRESHOLD_OPTIONS = [
  {
    value: 'off',
    label: t('Off'),
    details: t('Seer will never analyze any issues without manually clicking Start.'),
  },
  {
    value: 'super_low',
    label: t('Only the Most Actionable Issues'),
    details: t(
      'Seer will automatically run on issues that it thinks have an actionability of "super high." This targets around 2% of issues, but may vary by project.'
    ),
  },
  {
    value: 'low',
    label: t('Highly Actionable and Above'),
    details: t(
      'Seer will automatically run on issues that it thinks have an actionability of "high" or above. This targets around 10% of issues, but may vary by project.'
    ),
  },
  {
    value: 'medium',
    label: t('Moderately Actionable and Above'),
    details: t(
      'Seer will automatically run on issues that it thinks have an actionability of "medium" or above. This targets around 30% of issues, but may vary by project.'
    ),
  },
  {
    value: 'high',
    label: t('Minimally Actionable and Above'),
    details: t(
      'Seer will automatically run on issues that it thinks have an actionability of "low" or above. This targets around 70% of issues, but may vary by project.'
    ),
  },
  {
    value: 'always',
    label: t('All Issues'),
    details: t('Seer will automatically run on all new issues.'),
  },
] as const;

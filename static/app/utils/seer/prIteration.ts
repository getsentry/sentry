import {t} from 'sentry/locale';

export const PR_ITERATION_OPTIONS = [
  {value: true, label: t('On')},
  {value: false, label: t('Off')},
];

// Auto-Iterate listens for github.com webhooks only; GitHub Enterprise is left out.
export const NON_GITHUB_PR_ITERATION_WARNING = t(
  'Auto-Iterate on PRs only works with repositories on github.com.'
);

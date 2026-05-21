import {Tag} from '@sentry/scraps/badge';

import {t} from 'sentry/locale';

import type {AutofixOutcome} from './types';

const STAGE_ORDER: AutofixOutcome[] = [
  'root_cause',
  'solution',
  'code_changes',
  'pr_opened',
];

const STAGE_LABELS: Record<AutofixOutcome, string> = {
  root_cause: t('Root cause found'),
  solution: t('Solution proposed'),
  code_changes: t('Code changes drafted'),
  pr_opened: t('Pull request opened'),
};

export function LatestOutcomeChip({outcomes}: {outcomes: AutofixOutcome[]}) {
  const present = new Set(outcomes);
  const latest = [...STAGE_ORDER].reverse().find(s => present.has(s));
  if (!latest) {
    return null;
  }
  return <Tag variant="muted">{STAGE_LABELS[latest]}</Tag>;
}

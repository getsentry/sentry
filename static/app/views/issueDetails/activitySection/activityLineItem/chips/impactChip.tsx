import {IconCellSignal} from 'sentry/components/badge/iconCellSignal';
import {t} from 'sentry/locale';
import type {GroupActivityImpactAssessment} from 'sentry/types/group';

import {InlineChip} from './inlineChip';

type AssessmentLevel = NonNullable<GroupActivityImpactAssessment['data']['level']>;
type AssessmentScore = NonNullable<GroupActivityImpactAssessment['data']['score']>;

function getImpactBars(level: AssessmentLevel): 0 | 1 | 2 | 3 {
  switch (level) {
    case 'super_high':
    case 'high':
      return 3;
    case 'moderate':
      return 2;
    case 'low':
      return 1;
    case 'super_low':
      return 0;
  }
}

function getImpactLevelLabel(level: AssessmentLevel) {
  switch (level) {
    case 'super_low':
      return t('Super Low');
    case 'low':
      return t('Low');
    case 'moderate':
      return t('Moderate');
    case 'high':
      return t('High');
    case 'super_high':
      return t('Super High');
  }
}

export function ActivityImpactChip({
  level,
  score,
}: {
  level: AssessmentLevel;
  score: AssessmentScore;
}) {
  return (
    <InlineChip variant="compactLeading">
      <IconCellSignal size="xs" bars={getImpactBars(level)} />
      {getImpactLevelLabel(level)} ({score})
    </InlineChip>
  );
}

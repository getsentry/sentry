import type {SVGIconProps} from '@sentry/icons/svgIcon';

import {t} from 'sentry/locale';
import type {Group, ImpactAssessment, ImpactLevel} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';

export function getImpactLevelLabel(level: ImpactLevel) {
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

export const IMPACT_LEVEL_VARIANT = {
  super_low: 'success',
  low: 'success',
  moderate: 'warning',
  high: 'danger',
  super_high: 'danger',
} as const satisfies Record<ImpactLevel, SVGIconProps['variant']>;

/**
 * Whether the organization can see impact assessments.
 * Currently, the API won't have impact assessments in the results without the flag,
 * but that may change, so check the flag on the frontend as well.
 */
export function hasImpactAssessment(organization: Organization) {
  return organization.features.includes('seer-impact-assessment');
}

export function useHasImpactAssessment() {
  return hasImpactAssessment(useOrganization());
}

export function hasImpactFeedback(organization: Organization) {
  return organization.features.includes('seer-impact-assessment-feedback');
}

export function hasImpactCitations(organization: Organization) {
  return organization.features.includes('seer-impact-assessment-citations');
}

/**
 * An impact assessment that produced a level and score
 */
export type AssessedImpact = ImpactAssessment & {level: ImpactLevel; score: number};

/**
 * Returns the group's impact assessment when it has a level and score, if available
 */
export function useAssessedImpact(group: Group): AssessedImpact | null {
  const canSeeImpact = useHasImpactAssessment();
  const impact = group.derivedData?.impact;
  return canSeeImpact && impact?.level && impact.score !== null
    ? (impact as AssessedImpact)
    : null;
}

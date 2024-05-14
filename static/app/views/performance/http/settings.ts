import type {BadgeType} from 'sentry/components/badge/featureBadge';
import {t} from 'sentry/locale';

export const MODULE_TITLE = t('Requests');

export const NULL_DOMAIN_DESCRIPTION = t('Unknown Domain');

export const RELEASE_LEVEL: BadgeType = 'new';

// NOTE: Awkward typing, but without it `RELEASE_LEVEL` is narrowed and the comparison is not allowed
export const releaseLevelAsBadgeProps = {
  isAlpha: (RELEASE_LEVEL as BadgeType) === 'alpha',
  isBeta: (RELEASE_LEVEL as BadgeType) === 'beta',
  isNew: (RELEASE_LEVEL as BadgeType) === 'new',
};

export const CHART_HEIGHT = 160;
export const SPAN_ID_DISPLAY_LENGTH = 16;

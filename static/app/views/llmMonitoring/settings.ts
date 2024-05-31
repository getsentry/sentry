import type {BadgeType} from 'sentry/components/badge/featureBadge';
import {t} from 'sentry/locale';

export const MODULE_TITLE = t('LLM Monitoring');
export const BASE_URL = 'llm-monitoring';

export const RELEASE_LEVEL: BadgeType = '';

// NOTE: Awkward typing, but without it `RELEASE_LEVEL` is narrowed and the comparison is not allowed
export const releaseLevelAsBadgeProps = {
  isAlpha: (RELEASE_LEVEL as BadgeType) === 'alpha',
  isBeta: (RELEASE_LEVEL as BadgeType) === 'beta',
  isNew: (RELEASE_LEVEL as BadgeType) === 'new',
  variant: 'short' as const,
};

export const MODULE_DOC_LINK = 'https://docs.sentry.io/product/llm-monitoring/';

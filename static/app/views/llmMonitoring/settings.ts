import type {BadgeType} from 'sentry/components/badge/featureBadge';
import {t} from 'sentry/locale';

export const MODULE_TITLE = t('LLM Monitoring');
export const BASE_URL = 'llm-monitoring';

export const RELEASE_LEVEL: BadgeType = 'beta';

export const releaseLevelAsBadgeProps = {
  isNew: true,
};

export const MODULE_DOC_LINK = 'https://docs.sentry.io/product/insights/llm-monitoring/';

import type {FeatureBadgeProps} from 'sentry/components/badge/featureBadge';
import {t} from 'sentry/locale';

export const MODULE_TITLE = t('LLM Monitoring');
export const BASE_URL = 'llm-monitoring';

export const DATA_TYPE = t('LLM');
export const DATA_TYPE_PLURAL = t('LLMs');

export const RELEASE_LEVEL: FeatureBadgeProps['type'] = 'beta';

export const MODULE_DOC_LINK =
  'https://docs.sentry.io/product/insights/ai/llm-monitoring/';

export const MODULE_FEATURES = ['insights-addon-modules'];

import type {FeatureBadgeProps} from 'sentry/components/core/badge/featureBadge';
import {t} from 'sentry/locale';
import {ModuleName} from 'sentry/views/insights/types';

export const AI_LANDING_SUB_PATH = 'ai';
export const AI_LANDING_TITLE = t('AI');
export const AI_SIDEBAR_LABEL = t('AI');
export const AI_RELEASE_LEVEL: FeatureBadgeProps['type'] = 'beta';

export const MODULES = [ModuleName.AI];

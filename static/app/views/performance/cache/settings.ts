import type {BadgeType} from 'sentry/components/badge/featureBadge';
import {t} from 'sentry/locale';
import type {SpanMetricsQueryFilters} from 'sentry/views/starfish/types';

export const RELEASE_LEVEL: BadgeType = 'alpha';

// NOTE: Awkward typing, but without it `RELEASE_LEVEL` is narrowed and the comparison is not allowed
export const releaseLevelAsBadgeProps = {
  isAlpha: (RELEASE_LEVEL as BadgeType) === 'alpha',
  isBeta: (RELEASE_LEVEL as BadgeType) === 'beta',
  isNew: (RELEASE_LEVEL as BadgeType) === 'new',
};

export const MODULE_TITLE = t('Cache');

export const CHART_HEIGHT = 160;

export const CACHE_BASE_URL = '/performance/cache';

export const BASE_FILTERS: SpanMetricsQueryFilters = {
  'span.op': 'cache.get_item', //  TODO - add more span ops as they become available, we can't use span.module because db.redis is also `cache`
};

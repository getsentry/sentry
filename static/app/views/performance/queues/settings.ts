import type {BadgeType} from 'sentry/components/badge/featureBadge';
import {t} from 'sentry/locale';

export const MODULE_TITLE = t('Queues');

export const DESTINATION_TITLE = t('Destination Summary');

export const RELEASE_LEVEL: BadgeType = 'alpha';

export const releaseLevelAsBadgeProps = {
  isAlpha: (RELEASE_LEVEL as BadgeType) === 'alpha',
  isBeta: (RELEASE_LEVEL as BadgeType) === 'beta',
  isNew: (RELEASE_LEVEL as BadgeType) === 'new',
};

// TODO: Currently this only filters to celery tasks. Add or genericize to include other queue/messaging tasks when available.
export const DEFAULT_QUERY_FILTER = 'span.op:[queue.process,queue.publish]';

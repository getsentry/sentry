import type {BadgeType} from 'sentry/components/badge/featureBadge';
import {t} from 'sentry/locale';

export const MODULE_TITLE = t('Queues');
export const BASE_URL = 'queues';

export const DESTINATION_TITLE = t('Destination Summary');

export const RELEASE_LEVEL: BadgeType = 'beta';

export const releaseLevelAsBadgeProps = {
  isAlpha: (RELEASE_LEVEL as BadgeType) === 'alpha',
  isBeta: (RELEASE_LEVEL as BadgeType) === 'beta',
  isNew: (RELEASE_LEVEL as BadgeType) === 'new',
};

export const DEFAULT_QUERY_FILTER = 'span.op:[queue.process,queue.publish]';
export const CONSUMER_QUERY_FILTER = 'span.op:queue.process';
export const PRODUCER_QUERY_FILTER = 'span.op:queue.publish';

export const TRACE_STATUS_OPTIONS = [
  'ok',
  'cancelled',
  'unknown',
  'unknown_error',
  'invalid_argument',
  'deadline_exceeded',
  'not_found',
  'already_exists',
  'permission_denied',
  'resource_exhausted',
  'failed_precondition',
  'aborted',
  'out_of_range',
  'unimplemented',
  'internal_error',
  'unavailable',
  'data_loss',
  'unauthenticated',
];
export const RETRY_COUNT_OPTIONS = ['0', '1-3', '4+'];

export enum MessageActorType {
  PRODUCER = 'producer',
  CONSUMER = 'consumer',
}

export const MODULE_DESCRIPTION = t(
  'Understand the health and performance impact that queues have on your application and diagnose errors tied to jobs.'
);
export const MODULE_DOC_LINK =
  'https://docs.sentry.io/product/performance/queue-monitoring/';

export const ONBOARDING_CONTENT = {
  title: t('Start collecting Insights about your Queues!'),
  description: t('Our robot is waiting for your first background job to complete.'),
  link: MODULE_DOC_LINK,
};

import type {BadgeType} from 'sentry/components/badge/featureBadge';
import {t} from 'sentry/locale';
import {ModuleName} from 'sentry/views/starfish/types';

export const MODULE_TITLE = t('Requests');
export const BASE_URL = 'http';

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

export const BASE_FILTERS = {
  'span.module': ModuleName.HTTP,
  'span.op': 'http.client', // `span.module` alone isn't enough, since some SDKs create other `http.*` spans like `http.client.response_body`
};

export const MODULE_DESCRIPTION = t(
  'Find large and slow-to-load resources used by your application and understand their impact on page performance.'
);
export const MODULE_DOC_LINK = 'https://docs.sentry.io/product/performance/requests/';

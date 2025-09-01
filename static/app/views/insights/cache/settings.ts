import {t} from 'sentry/locale';
import type {SpanQueryFilters} from 'sentry/views/insights/types';

export const MODULE_TITLE = t('Caches');
export const BASE_URL = 'caches';
export const DATA_TYPE = t('Cache');
export const DATA_TYPE_PLURAL = t('Caches');

export const CACHE_BASE_URL = `/performance/${BASE_URL}`;

export const BASE_FILTERS: SpanQueryFilters = {
  'span.op': '[cache.get_item,cache.get]',
}; // TODO - Its akward to construct an array here, mutibleSearch should support array values

export const MODULE_DOC_LINK = 'https://docs.sentry.io/product/insights/backend/caches/';

export const MODULE_FEATURES = ['insight-modules'];

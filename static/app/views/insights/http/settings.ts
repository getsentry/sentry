import {t} from 'sentry/locale';
import {ModuleName} from 'sentry/views/insights/types';

export const MODULE_TITLE = t('Outbound API Requests');
export const FRONTEND_MODULE_TITLE = t('Network Requests');
export const MODULE_SIDEBAR_TITLE = t('Requests');
export const DATA_TYPE = t('Request');
export const DATA_TYPE_PLURAL = t('Requests');
export const BASE_URL = 'http';

export const NULL_DOMAIN_DESCRIPTION = t('Unknown Domain');

export const CHART_HEIGHT = 160;
export const SPAN_ID_DISPLAY_LENGTH = 16;

export const BASE_FILTERS = {
  'span.module': ModuleName.HTTP,
  'span.op': 'http.client', // `span.module` alone isn't enough, since some SDKs create other `http.*` spans like `http.client.response_body`
};

export const MODULE_DESCRIPTION = t(
  'Monitor outgoing HTTP requests and investigate errors and performance bottlenecks tied to domains.'
);
export const MODULE_DOC_LINK =
  'https://docs.sentry.io/product/insights/backend/requests/';

export const MODULE_FEATURES = ['insights-initial-modules'];

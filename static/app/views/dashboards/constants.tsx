import {t} from 'sentry/locale';

export const DASHBOARD_SAVING_MESSAGE = t('Saving changes\u2026');

export const NUM_DESKTOP_COLS = 6;

// Must match the limit enforced by the backend serializer at
// src/sentry/api/serializers/rest_framework/dashboard.py.
export const MAX_WIDGET_DESCRIPTION_LENGTH = 350;
export const MAX_WIDGET_TITLE_LENGTH = 255;
export const MAX_DASHBOARD_TITLE_LENGTH = 255;

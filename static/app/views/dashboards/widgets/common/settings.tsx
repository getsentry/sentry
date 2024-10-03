import {t} from 'sentry/locale';

export const MIN_WIDTH = 200;
export const MIN_HEIGHT = 120;

export const DEFAULT_FIELD = 'unknown'; // Numeric data might, in theory, have a missing field. In this case we need a fallback to provide to the field rendering pipeline. `'unknown'` will results in rendering as a string

export const MISSING_DATA_MESSAGE = t('No Data');
export const NON_FINITE_NUMBER_MESSAGE = t('Value is not a finite number.');

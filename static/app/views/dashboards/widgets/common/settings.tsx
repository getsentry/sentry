import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export const MIN_WIDTH = 110;
export const MIN_HEIGHT = 96;

export const Y_GUTTER = space(1.5);
export const X_GUTTER = space(2);

export const DEFAULT_FIELD = 'unknown'; // Numeric data might, in theory, have a missing field. In this case we need a fallback to provide to the field rendering pipeline. `'unknown'` will results in rendering as a string

export const MISSING_DATA_MESSAGE = t('No Data');
export const NON_FINITE_NUMBER_MESSAGE = t('Value is not a finite number.');
export const WIDGET_RENDER_ERROR_MESSAGE = t(
  'Sorry, something went wrong when rendering this widget.'
);
